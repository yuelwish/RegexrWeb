# 正则表达式在线工具 - 设计规格

## 一、项目概述

一个轻量、高性能的正则表达式在线工具，替代 regexr.com。专注于三个核心功能：**正则匹配**、**捕获组提取**、**替换**。纯前端，静态部署到 nginx。

### 解决的痛点

regexr.com 存在的已知问题：
1. `$1` 等捕获组引用在提取时拿不到值
2. 匹配高亮有时不准确（匹配上但未高亮，或反之）

本工具必须确保这两个功能 100% 正确。

---

## 二、功能需求

### 核心功能

| 功能 | 描述 |
|------|------|
| 正则输入 | 输入正则表达式，显示 flags 开关（g/i/m/s/u/y），实时校验正则语法 |
| 文本输入 | 粘贴/输入任意文本，支持大文本（10MB+），CodeMirror 6 虚拟化渲染 |
| 匹配高亮 | 实时高亮所有匹配项，显示匹配数量，点击匹配项可定位 |
| 捕获组提取 | 列出所有匹配及其捕获组（$1, $2...），支持命名捕获组 |
| 替换 | 输入替换模板（支持 $1, $2, $& 等），实时预览替换结果 |

### 非功能需求

| 维度 | 要求 |
|------|------|
| 性能 | 10MB 文本输入不卡顿，正则匹配 <100ms（常规表达式），主线程零阻塞 |
| 兼容性 | Chrome 111+, Firefox 114+, 手机 H5（iOS Safari 16.4+, Android Chrome） |
| 部署 | `vite build` 产出纯静态文件（index.html + JS/CSS bundle），直接丢 nginx |
| 加载速度 | 首屏 <500ms，gzip 后总体积 <200KB |

---

## 三、技术栈

| 层级 | 选型 | 版本 | 理由 |
|------|------|------|------|
| 构建工具 | Vite | 6.x | 极速构建，原生 ES 模块，产出纯静态 |
| 前端框架 | Vanilla JS | ES2024 | 零运行时，工具类应用无需框架开销 |
| 代码编辑器 | CodeMirror 6 | 6.x | ~120KB gzip，移动端触摸优化，内置大文本虚拟化 |
| Worker 通信 | Comlink | 4.x | ~1KB，极简易 Worker 封装 |
| CSS | 原生 CSS | - | 无预处理器，变量实现主题，最小化依赖 |

### 依赖清单

```
生产依赖：
- codemirror (^6.0.1)           # 编辑器 bundle
- @codemirror/view (^6.x)       # 视图层 + Decoration API
- @codemirror/state (^6.x)      # 状态管理
- @codemirror/language (^6.x)   # 语言支持基础
- comlink (^4.x)                # Worker 通信

开发依赖：
- vite (^6.x)                   # 构建工具
```

---

## 四、架构设计

### 整体架构

```
┌─────────────────────────────────────────────┐
│                   index.html                │
├─────────────────────────────────────────────┤
│  UI 层 (Vanilla JS + DOM)                   │
│  ├── RegexInput    正则输入 + flags 控制     │
│  ├── TextEditor    CodeMirror 6 文本编辑器   │
│  ├── ResultPanel   提取结果 / 替换面板       │
│  └── ThemeToggle   深色/浅色主题切换         │
├─────────────────────────────────────────────┤
│  状态层 (Proxy-based)                       │
│  ├── state.pattern    正则表达式             │
│  ├── state.flags      匹配标志               │
│  ├── state.text       输入文本               │
│  ├── state.matches    匹配结果数组           │
│  └── state.panelMode  'extract' | 'replace' │
├─────────────────────────────────────────────┤
│  引擎层 (Web Worker)                        │
│  ├── RegexEngine   正则匹配/提取/替换        │
│  └── 分片处理       大文本分批匹配            │
└─────────────────────────────────────────────┘
```

### 核心模块

#### 1. RegexEngine（Web Worker）

正则匹配核心，运行在 Worker 中防止阻塞主线程。

```javascript
// regex-worker.js
// 关键实现：
// - 用 RegExp.exec() 循环获取所有匹配（非 String.match()）
// - 每个 match 对象包含: index, length, text, groups (含 $1, $2...)
// - 大文本分片：超过 100KB 时分段匹配，每段返回增量结果
// - 超时保护：单次匹配超过 500ms 自动中断，防止灾难性回溯
```

**$1 捕获组修复方案**：
- 使用 `RegExp.exec()` 而非 `String.match()`，获取完整 match 对象
- match[0] = 完整匹配, match[1] = $1, match[2] = $2, ...
- 命名捕获组: match.groups.name
- 替换模板: 自定义解析器处理 `$1`, `$2`, `$&`, `$`` , `$'` 等

**高亮准确性修复方案**：
- 基于 `exec()` 返回的精确 `match.index` 和 `match[0].length`
- 通过 CodeMirror 6 的 `Decoration.mark` API 在精确位置渲染高亮
- 每次文本或正则变化时，清除旧 Decoration 重建新的

#### 2. TextEditor（CodeMirror 6）

```javascript
// 关键配置：
// - 虚拟化视口：CodeMirror 6 内置，只渲染可见行
// - 匹配高亮 Decoration：由 Engine 返回的 matches 数组驱动
// - 正则语法高亮：自定义 Lezer 或简单 tokenizer
// - 行号显示
// - 搜索/替换快捷键
```

#### 3. RegexInput

```
// 组成：
// - / 正则表达式 / flags
// - flags 按钮: g(全局) i(忽略大小写) m(多行) s(dotAll) u(unicode) y(sticky)
// - 实时正则语法校验（正则无效时显示错误信息）
// - 匹配计数显示
```

#### 4. ResultPanel

```
// 两个模式通过 Tab 切换：
// 提取模式：
//   - 列出所有匹配项（编号、匹配文本、位置）
//   - 每个匹配下展示捕获组 $1, $2, ...
//   - 支持复制全部 / 复制单个
// 替换模式：
//   - 替换模板输入框（支持 $1, $2, $& 等）
//   - 实时预览替换结果
//   - 支持复制到剪贴板
// 面板可收缩为窄条（仅显示一条竖线和匹配数）
```

---

## 五、布局设计

### 桌面端 (>768px)

```
┌──────────────────────────────────────────────┐
│ / 正则表达式 /  g i m s     [5 matches]  🌙  │  ← 正则输入栏（固定）
├──────────────────────────┬───────┬───────────┤
│                          │       │           │
│   文本编辑器             │ ◀▶   │ 提取/替换 │  ← 右侧面板可收缩
│   (CodeMirror 6)         │       │ 面板      │
│                          │       │           │
│                          │       │           │
├──────────────────────────┴───────┴───────────┤
│ 点击 ◀ 收缩面板 | Worker 延迟: 2ms           │  ← 状态栏
└──────────────────────────────────────────────┘
```

- 收缩状态：右侧面板折叠为 32px 窄条，显示 ▶ 展开按钮 + 匹配数
- 面板宽度可拖拽调整（可选，v2）

### 移动端 (<768px)

```
┌────────────────────┐
│ / 正则 / g    🌙   │  ← 紧凑正则输入
├────────────────────┤
│ 文本 | 提取(5) | 替换│  ← Tab 切换
├────────────────────┤
│                    │
│  当前 Tab 内容     │  ← 全宽显示
│                    │
└────────────────────┘
```

### 主题

- 默认深色：Tokyo Night 配色方案
  - 背景 #1a1b26, 文本 #a9b1d6, 高亮 #7aa2f7, 匹配 #9ece6a
- 浅色主题：类 GitHub 风格
  - 背景 #ffffff, 文本 #24292f, 高亮 #0969da, 匹配 #1a7f37
- 使用 CSS 自定义属性实现主题切换，无运行时开销

---

## 六、性能策略

### 大文本处理

1. **CodeMirror 6 虚拟化视口**：只渲染可见行的 DOM，10MB 文本零压力
2. **Web Worker 匹配**：正则匹配在 Worker 线程执行，不阻塞 UI
3. **分片匹配**：大文本（>100KB）按行分片，Worker 分批处理并增量返回结果
4. **防抖**：正则/文本输入 150ms 防抖，避免频繁触发匹配
5. **超时保护**：单次正则匹配超过 500ms 自动中断，提示用户正则可能有性能问题

### 加载优化

1. **代码分割**：CodeMirror 独立 chunk，利用浏览器长期缓存
2. **Gzip**：nginx 开启 gzip，总体积 ~150KB
3. **资源预加载**：`<link rel="modulepreload">` 关键 JS
4. **无外部字体**：使用系统字体栈，避免字体加载延迟

---

## 七、项目结构

```
RegexrWeb/
├── index.html              # 入口 HTML
├── vite.config.js          # Vite 配置
├── package.json
├── src/
│   ├── main.js             # 应用入口
│   ├── style.css           # 全局样式 + 主题变量
│   ├── state.js            # Proxy-based 状态管理
│   ├── regex-worker.js     # Web Worker 正则引擎
│   ├── components/
│   │   ├── regex-input.js  # 正则输入组件
│   │   ├── text-editor.js  # CodeMirror 6 编辑器
│   │   ├── result-panel.js # 提取/替换面板
│   │   └── theme-toggle.js # 主题切换
│   └── utils/
│       ├── regex-engine.js # 正则匹配逻辑（Worker 内）
│       ├── subst-parser.js # 替换模板解析器
│       └── highlight.js    # CodeMirror Decoration 高亮
└── public/
    └── favicon.svg
```

---

## 八、部署

`vite build` 产出 `dist/` 目录，包含：
- `index.html`
- `assets/` (JS/CSS bundles with hash)

直接复制到 nginx 的 webroot 即可使用。

```nginx
server {
    listen 80;
    root /var/www/regex-tool/dist;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/javascript application/json;
    gzip_min_length 1000;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

---

## 九、不做的事情（YAGNI）

- ❌ 用户账号/登录系统
- ❌ 正则表达式保存/分享
- ❌ PCRE 引擎支持（只做 JavaScript 正则）
- ❌ 正则表达式库/常用正则
- ❌ 后端 API
- ❌ 多标签页编辑
- ❌ 正则语法详细参考面板（regexr 有，但非核心）
- ❌ 拖拽调整面板宽度（v2 再考虑）
