# RegExrWeb

RegExr 的 Web 克隆版，正则表达式在线测试工具。

## 开发命令

```bash
pnpm dev           # 开发服务器 (Vite)
pnpm build         # 构建到 dist/
pnpm preview       # 预览构建结果
pnpm test          # 运行测试 (Vitest)
pnpm test:watch    # 测试监视模式
```

## 项目结构

```
src/
── main.js              # 入口文件
├── engine/              # 核心引擎
│   ├── regex-solver.js  # 正则匹配（Worker 封装）
│   ├── regex-worker.js  # Worker 实现
│   └── template-parser.js # 模板解析 ($&, $1, \n 等)
├── ui/                  # UI 组件
│   ├── expression.js    # 正则输入框（语法高亮）
│   ├── text.js          # 文本编辑器（CodeMirror 6）
│   ├── tools.js         # 工具面板（Match/Extract/Replace/Details）
│   └── header.js        # 顶部栏
├── utils/               # 工具函数
└── styles/              # CSS 样式
```

## 架构要点

### Web Worker 正则匹配
- `regex-solver.js` 封装 Worker，浏览器环境异步调用
- `regex-worker.js` 执行实际正则匹配
- 大文本（>1MB）使用 Transferable Objects 零拷贝
- Node 测试环境直接 import，浏览器环境通过 Worker

### 模板解析器
支持占位符：
- `$&`, `$0` - 完整匹配
- `$1`, `$2`... - 数字捕获组
- `${name}` - 命名捕获组
- `$`` , `$'` - 匹配前/后文本
- `\n`, `\t` - 转义序列（字面字符串，非实际换行）

### CodeMirror 6
- Text 区使用 CodeMirror 6 编辑器
- 语法高亮通过覆盖层实现（input + highlight div）
- 装饰器 (Decoration) 用于匹配高亮

## 测试

```bash
# 运行所有测试
pnpm test

# 运行单个测试文件
pnpm test tests/engine/template-parser.test.js

# 监视模式
pnpm test:watch
```

- 测试环境：jsdom
- 单 worker 模式（`maxWorkers: 1`）
- 测试文件：`tests/**/*.test.js`

## 样式约定

- CSS 变量定义在 `src/styles/tokens.css`
- 组件样式按功能拆分（expression.css, text.css, tools.css 等）
- 移动端适配在 `mobile.css`
- 字体：Inter (UI) + JetBrains Mono (代码)

## 关键文件

| 文件 | 说明 |
|------|------|
| `src/main.js` | 应用入口，组件初始化，事件绑定 |
| `src/engine/regex-solver.js` | 正则匹配入口（Worker/直接调用） |
| `src/engine/template-parser.js` | Extract/Replace 模板解析 |
| `src/ui/text.js` | CodeMirror 编辑器，匹配高亮 |
| `src/ui/tools.js` | 工具面板 UI |
| `src/ui/expression.js` | 正则输入，语法高亮 |
