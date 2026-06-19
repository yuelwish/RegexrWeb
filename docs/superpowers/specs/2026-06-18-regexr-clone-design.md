# RegExr 克隆版 · 设计文档

**日期**: 2026-06-18
**作者**: 用户 + 协作设计
**状态**: 待实现
**预览 Mockup**: `.superpowers/brainstorm/32060-1781783414/content/final-tokyo-night.html`

---

## 1. 项目目标

构建一个**纯静态、纯前端**的正则表达式在线工具，复刻 [regexr.com](https://regexr.com) 的核心功能，并修复其两个已知 bug。

### 1.1 要解决的核心问题

| 问题 | regexr.com 现状 | 本项目修复方案 |
|------|----------------|----------------|
| **`$1` 捕获组提取失效** | 用户写 `$1` 提取时拿不到值 | 用 `RegExp.exec()` 获取完整 match 对象，自建模板解析器 |
| **匹配高亮不准确** | 匹配上了不高亮 / 没匹配上却高亮 | 基于 `exec()` 返回的精确 `index + length`，通过 CodeMirror 6 Decoration API 渲染 |
| **大文本卡顿** | 长文本匹配慢、UI 阻塞 | Web Worker 跑正则 + 大文本分片 + CodeMirror 6 内置视口虚拟化 |

### 1.2 非目标（YAGNI）

明确不做的事：
- ❌ PHP/PCRE 引擎（只做 JavaScript 正则）
- ❌ 用户账号 / 登录 / 保存云端
- ❌ Community 社区模式 / 分享 / 评分
- ❌ 后端服务器（完全静态，丢到 nginx 即用）
- ❌ 多语言国际化（仅英文 UI，中文内容用户自行输入）
- ❌ Tests 模式（正则测试套件）
- ❌ Explain 模式（正则自然语言解释）

---

## 2. 用户画像与场景

**核心用户**：开发者 / 数据处理人员
**典型场景**：
1. 从网页/文档复制大段文本（10MB+），用正则提取所有 URL / 图片地址 / 邮箱等
2. 写替换模板批量重命名（如 `[IMG:$1]`）
3. 临时验证某个正则是否能匹配目标字符串

**关键需求**：
- 加载快（首屏 < 1 秒）
- 匹配快（10MB 文本秒级响应）
- 匹配准（`$1` 必须正确）
- 兼容 Chrome / Firefox / 手机 H5

---

## 3. 技术栈

| 层级 | 选型 | 版本 | 理由 |
|------|------|------|------|
| **构建** | Vite | 6.0+ | Rolldown 打包、Oxc 压缩、纯静态输出直丢 nginx |
| **框架** | Vanilla JS | ES2024+ | 零运行时，工具类应用无需框架 |
| **编辑器** | CodeMirror 6 | 6.41+ | ~120KB gzip、移动端触摸优化、内置大文本视口虚拟化、模块化可扩展 |
| **Worker** | Comlink | 4.3+ | 1.1KB，Proxy 封装，自动 Transferable |
| **字体** | Inter（UI）+ JetBrains Mono（代码） | Google Fonts | 现代 + 等宽清晰 |
| **部署** | 纯静态 + nginx | - | `vite build` 直出 `dist/` |
| **兼容性** | Chrome 111+ / Firefox 114+ / Safari 16.4+ | - | 现代浏览器基线 |

### 3.1 依赖清单

```json
{
  "dependencies": {
    "codemirror": "^6.0.1",
    "@codemirror/view": "^6.41.0",
    "@codemirror/state": "^6.5.0",
    "@codemirror/lang-javascript": "^6.2.2",
    "@codemirror/language": "^6.10.0",
    "@codemirror/commands": "^6.5.0",
    "@codemirror/search": "^6.5.0",
    "comlink": "^4.4.1"
  },
  "devDependencies": {
    "vite": "^6.0.0"
  }
}
```

**总包体积预估**：~150KB gzipped（对比 regexr + Monaco 方案小 90%+）

---

## 4. 架构

### 4.1 模块划分

```
src/
├── index.html                # 入口
├── main.js                   # 主入口，初始化
├── styles/
│   ├── tokens.css            # CSS 变量（Tokyo Night）
│   ├── base.css              # 重置 + 基础
│   ├── layout.css            # 三块布局
│   └── mobile.css            # 响应式
├── ui/
│   ├── header.js             # 顶部栏（logo + 主题切换）
│   ├── expression.js         # Expression 区（正则输入 + flags）
│   ├── text.js               # Text 区（CodeMirror 文本编辑 + 匹配高亮）
│   └── tools.js              # Tools 区（4 个 Tab：Match/Extract/Replace/Details + 切换逻辑）
├── engine/
│   ├── regex-solver.js       # 主线程调度器（防抖 + Worker 调用 + 结果分发）
│   ├── regex-worker.js       # Web Worker：跑正则（Comlink expose）
│   └── template-parser.js    # 自建 $1 $2 模板解析器（修复 regexr bug）
└── utils/
    ├── debounce.js           # 防抖（输入节流）
    └── theme.js              # 深色/浅色主题切换
```

### 4.2 数据流

```
用户输入正则 + 文本
        │
        ▼
    [debounce 300ms]
        │
        ▼
regex-solver.js (主线程)
        │
        ▼  Comlink.wrap(worker)
regex-worker.js (Web Worker)
   │
   ├── new RegExp(pattern, flags)
   ├── 循环 exec(text)
   │     ├── 收集 match.index
   │     ├── 收集 match[0]
   │     ├── 收集 match.groups ($1, $2...)
   │     └── 安全退出（防灾难性回溯，> 10000 次中断）
   │
   ▼
返回 { matches: [...], error? }
        │
        ▼
主线程接收
   │
   ├── Text 区：CodeMirror Decoration API 高亮（精确 index + length）
   ├── Tools.Match：渲染匹配列表 + 点击选中
   ├── Tools.Extract：template-parser 应用模板，输出纯文本
   └── Tools.Replace：template-parser 应用替换，预览全文
```

### 4.3 关键修复：`$1` 捕获组

**根因分析（regexr.com）**：regexr 使用 `String.prototype.replace()` 的隐式行为 + 自定义高亮，部分场景下 groups 丢失。

**修复方案**：

```javascript
// regex-worker.js
function solve(pattern, flags, text) {
  const re = new RegExp(pattern, flags);
  const matches = [];
  let m;
  let iter = 0;
  const MAX_ITER = 50000; // 安全阀

  while ((m = re.exec(text)) !== null) {
    if (re.lastIndex === m.index) re.lastIndex++; // 防空匹配死循环
    if (++iter > MAX_ITER) break;

    const groups = [];
    for (let i = 0; i < m.length; i++) {
      if (m[i] !== undefined) {
        groups.push({ index: i, value: m[i] });
      }
    }

    matches.push({
      index: m.index,
      length: m[0].length,
      full: m[0],
      groups,               // 显式保留所有 group
      namedGroups: m.groups // 命名捕获组
    });

    if (!re.global) break;
  }

  return matches;
}
```

```javascript
// template-parser.js
// 自建解析器，不依赖 String.replace() 的隐式行为
function applyTemplate(template, match) {
  return template.replace(/\$(\d+)|\$\{(\w+)\}|\\n|\\t/g, (token, num, name) => {
    if (token === '\\n') return '\n';
    if (token === '\\t') return '\t';
    if (num !== undefined) {
      const idx = parseInt(num, 10);
      const g = match.groups.find(g => g.index === idx);
      return g ? g.value : '';
    }
    if (name !== undefined) {
      return match.namedGroups?.[name] ?? '';
    }
    return token;
  });
}
```

### 4.4 关键修复：匹配高亮

使用 CodeMirror 6 的 **Decoration API**：

```javascript
import { Decoration, ViewPlugin } from '@codemirror/view';

function highlightMatches(matches) {
  const decorations = matches.map(m =>
    Decoration.mark({ class: 'cm-match', attributes: { 'data-idx': m.index } })
      .range(m.index, m.index + m.length)
  );
  return Decoration.set(decorations, true);
}
```

通过 `exec()` 返回的精确 `index` 和 `length` 定位，**不依赖字符串搜索**，确保位置零偏移。

---

## 5. UI 布局

### 5.1 桌面端（>768px）

```
┌────────────────────────────────────────────┐
│  顶部栏 (52px)                             │
│  [logo] RegExr        🌙 GitHub Help       │
├────────────────────────────────────────────┤
│  Expression 区 (auto)                      │
│  ┌─header─┐  [g✓] [i] [m] [s] [u] [y]     │
│  └────────┘                                │
│  / https?://[\w.-]+/\S+\.(jpg|png|gif) /   │
├────────────────────────────────────────────┤
│  Text 区 (flex: 1)                         │
│  ┌─header─┐ [Text|Tests]      ● 5 matches │
│  └────────┘                                │
│  1 │ RegExr was created by gskinner.com.   │
│  2 │                                       │
│  3 │ Main image: https://cdn.../photo.jpg  │  ← 匹配高亮蓝色
│  4 │ Thumbnail: https://img.../thumb.png   │
│  ...                                       │
├────────────────────────────────────────────┤
│  Tools 区 (max-height: 50%)                │
│  ┌─header─┐ [Match|Extract|Replace|Details]│
│  └────────┘                                │
│  [Template] $1 - $0                        │  ← 输入框（Extract/Replace 时显示）
│  ─────────────────────────                 │
│  jpg - https://cdn.../photo.jpg            │  ← 结果区
│  png - https://img.../thumb.png            │
│  ...                                       │
└────────────────────────────────────────────┘
```

### 5.2 移动端（<768px）

- 顶部栏高度压缩到 48px
- Expression / Text / Tools 仍垂直堆叠
- Tools 区的 Tab 改为**横向滚动条**或**下拉菜单**
- 字体缩小到 12-13px
- 间距减半

### 5.3 Tools 区 Tab 行为

| Tab | 顶部输入框 | 结果区内容 |
|-----|-----------|-----------|
| **Match**（默认） | 隐藏 | 匹配列表 + 选中项的 `$1 $2` 详情（表格） |
| **Extract** | 显示（label: "Template"，默认值 `$1 - $0`） | 按模板渲染的纯文本，便于复制 |
| **Replace** | 显示（label: "Replace"，默认值 `[IMG:$1]`） | 替换后的全文预览 |
| **Details** | 隐藏 | 完整匹配详情表格（所有捕获组） |

**输入框行为**：
- Extract/Replace 的输入框都是**单行**，回车或失去焦点触发重新计算
- 输入框支持 `$0`（全匹配）、`$1` `$2`（捕获组）、`${name}`（命名捕获组）、`\n` `\t`
- 结果区实时响应（防抖 200ms）

**边界行为**：
- 正则输入为空 → 所有高亮清除，Tools 区显示 "Enter a regular expression above"
- 文本为空 → Tools 区显示 "No text to match"
- 正则语法错误 → Expression 区红框 + 显示错误信息，不清除已有结果
- 无匹配 → Text 区无高亮，Tools.Match 显示 "No matches"，Extract/Replace 输出空
- 灾难性回溯 → Worker 250ms 超时，Expression 区显示橙色警告 "Pattern may be too complex"

---

## 6. 样式设计（Tokyo Night）

### 6.1 调色板

```css
:root {
  /* 背景三级渐变 */
  --bg:           #1a1b26;   /* 最深层：主背景 */
  --bg-elev:      #1f2335;   /* 中层：代码区、输入框 */
  --bg-surface:   #24283b;   /* 浅层：header、选中态 */

  /* 边框 */
  --border:         #3b4261;
  --border-subtle:  #292e42;

  /* 文字 */
  --text:        #c0caf5;   /* 主文字 */
  --text-dim:    #a9b1d6;   /* 次要文字 */
  --text-muted:  #565f89;   /* 弱文字 */
  --text-faint:  #3b4261;   /* 行号等极弱文字 */

  /* 功能色 */
  --accent:      #7aa2f7;   /* 主蓝：logo、flag 选中、Tab 选中、匹配高亮、表头 */
  --accent-dim:  #5d7ec7;
  --green:       #9ece6a;   /* 状态 pass、捕获组 $0 */
  --purple:      #bb9af7;   /* 锚点、转义 */
  --red:         #f7768e;   /* 错误 */
  --orange:      #ff9e64;   /* 量词、警告 */
  --yellow:      #e0af68;   /* 字符集 [...]、提示 */
  --cyan:        #7dcfff;   /* 捕获组值 */
}
```

### 6.2 正则 token 着色

| Token 类型 | 颜色 | 示例 |
|-----------|------|------|
| 普通字符 | `--text` | `abc` |
| 量词 | `--orange` | `*` `+` `?` `{2,}` |
| 捕获组 `()` | `--green` | `(abc)` |
| 字符集 `[]` | `--yellow` | `[\w.-]` |
| 锚点 | `--purple` | `^` `$` `\b` |
| 转义 | `--purple` | `\d` `\s` `\.` |
| 装饰符 | `--text-muted` | `\|` |

### 6.3 字体

```css
--font-ui:   'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', 'Source Code Pro', Consolas, monospace;
```

- UI 元素（header、按钮、标签）：Inter 14px
- 代码/正则/结果：JetBrains Mono 13-15px

### 6.4 圆角与间距

```css
--radius:    6px;   /* 主组件：输入框、表格、提示框 */
--radius-sm: 4px;   /* 小组件：flags、tabs、badge */

--space-xs:  4px;
--space-sm:  8px;
--space-md:  12px;
--space-lg:  16px;
--space-xl:  24px;
```

### 6.5 交互反馈

- 匹配 hover：`rgba(122,162,247,.4)` 加深
- 匹配选中：`rgba(122,162,247,.5)` + 外发光描边 `0 0 0 2px`
- Flag/Tab 切换：`transition: all .15s`
- 输入框 focus：border 变 `--accent`

### 6.6 浅色主题

通过 CSS 变量覆盖（用户点击顶部 🌙 按钮切换，状态存 localStorage）：

```css
[data-theme="light"] {
  --bg: #ffffff;
  --bg-elev: #f6f8fa;
  --bg-surface: #eef1f5;
  --border: #d0d7de;
  --text: #1f2328;
  --text-dim: #444d56;
  --text-muted: #8b949e;
  --accent: #0969da;
  /* ... 其余功能色适当调暗 */
}
```

---

## 7. 性能目标

| 指标 | 目标 | 手段 |
|------|------|------|
| 首屏加载（gzip） | < 200KB | Vite + Rolldown tree-shaking，CDN 字体异步 |
| 首屏可交互 | < 1s | CodeMirror 按需初始化，Worker 懒加载 |
| 1MB 文本匹配 | < 500ms | Web Worker + 分片 |
| 10MB 文本匹配 | < 3s | Web Worker + Transferable Objects |
| 100MB 文本匹配 | < 30s 且不阻塞 UI | 分片流式返回，增量高亮 |
| 编辑器滚动 | 60fps | CodeMirror 6 内置视口虚拟化 |
| 输入防抖 | 300ms | 正则输入节流，避免频繁 Worker 调用 |
| 灾难性回溯 | 不卡死 | Worker 内 50000 次迭代上限 + 250ms 超时 |

---

## 8. 部署

```bash
# 构建
npm install
npm run build

# 产出 dist/
# ├── index.html
# ├── assets/
# │   ├── [hash].js       # 应用 + Worker
# │   ├── [hash].css      # 样式
# │   └── ...
# └── favicon.ico
```

**nginx 配置**：

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

    location ~* \.(js|css|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location ~* \.html$ {
        expires -1;
        add_header Cache-Control "no-cache";
    }
}
```

---

## 9. 验证标准

实现完成后必须通过以下测试：

### 9.1 功能验证

| 测试用例 | 预期 |
|---------|------|
| 正则 `https?://[\w.-]+/\S+\.(jpg\|png\|gif)` 在示例文本中 | 正确高亮 5 处，颜色蓝色半透明 |
| 点击第 2 个匹配 | Tools.Match 显示该匹配详情，`$1 = png` |
| Extract Tab 输入 `$1 - $0` | 输出 5 行，每行格式 `jpg - https://...` |
| Replace Tab 输入 `[IMG:$1]` | 预览区所有匹配被替换为 `[IMG:jpg]` `[IMG:png]` 等 |
| 命名捕获组 `(?<ext>jpg\|png)` + Extract `${ext}` | 正确输出扩展名 |
| 灾难性正则 `(a+)+$` 在 "aaaaaa..." 上 | Worker 250ms 超时，Expression 区显示橙色警告，UI 不卡 |
| 正则输入清空 | 高亮清除，Tools 区提示 "Enter a regular expression above" |
| 正则语法错误（如 `[abc` 未闭合） | Expression 区红框 + 错误信息，UI 不崩溃 |
| 无匹配 | Tools 区显示 "No matches" |
| 10MB 文本 | 匹配完成 < 3s，滚动流畅 |

### 9.2 兼容性验证

- Chrome 111+（最新稳定）
- Firefox 114+（最新稳定）
- Safari 16.4+（iOS/iPadOS）
- 移动端 H5（iOS Safari + Android Chrome）

### 9.3 部署验证

- `vite build` 成功
- `dist/` 丢入 nginx 后访问 `index.html` 正常
- 刷新任意路由正常（SPA fallback）
- 静态资源 1 年缓存，HTML 不缓存

---

## 10. 里程碑

1. **M1 · 项目脚手架**：Vite + Vanilla JS + CodeMirror 6 + Comlink，能跑通 Hello World
2. **M2 · 核心引擎**：Worker 跑正则 + 主线程接收 + 模板解析器，单测通过
3. **M3 · 三块 UI 骨架**：Expression / Text / Tools 区静态布局，Tab 切换可点击
4. **M4 · 集成**：正则输入 → Worker → 高亮 → Tab 结果全链路
5. **M5 · 样式精修**：Tokyo Night 完整应用，浅色主题，移动端响应
6. **M6 · 性能与部署**：大文本测试、nginx 部署、验证标准通过

详细实现计划将在 `writing-plans` 阶段细化。

---

## 附录 A：参考 Mockup

- 完整样式预览：`.superpowers/brainstorm/32060-1781783414/content/final-tokyo-night.html`
- 主题对比：`.superpowers/brainstorm/32060-1781783414/content/theme-compare.html`
- regexr.com 原始复刻：`.superpowers/brainstorm/32060-1781783414/content/regexr-1to1-replica.html`

## 附录 B：regexr.com 源码分析

- GitHub: https://github.com/gskinner/regexr
- 技术栈：原生 JS + Gulp 4 + Rollup 1 + CodeMirror 5（老）+ PHP 后端
- 本项目的关键改进点：见 §1.1 和 §4.3
