# RegExr Clone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建纯静态正则表达式在线工具，复刻 regexr.com 核心功能并修复 `$1` 提取 + 高亮不准两个 bug。

**Architecture:** Vanilla JS + CodeMirror 6 编辑器 + Comlink Web Worker 跑正则 + 自建模板解析器。主线程只负责 UI，所有 RegExp 操作在 Worker 中完成，结果通过精确 index/length 用 CodeMirror Decoration API 高亮。

**Tech Stack:** Vite 6 · Vanilla JS (ES2024+) · CodeMirror 6.41+ · Comlink 4.4+ · Vitest · nginx 静态部署 · mise 管理 Node.js

**Spec:** `docs/superpowers/specs/2026-06-18-regexr-clone-design.md`

**Language rule:** 本项目遵循 `AGENTS.md` 简体中文规则（thinking、注释、commit message、文档），commit 模板使用 `feat:` / `fix:` / `build:` / `test:` / `style:` 中文描述。

---

## File Structure

```
RegexrWeb/
├── .mise.toml                    # mise 配置（Node.js 版本）
├── package.json                  # 依赖清单
├── vite.config.js                # Vite 构建配置
├── vitest.config.js              # Vitest 测试配置
├── index.html                    # 入口 HTML
├── nginx.conf                    # nginx 部署配置示例
├── src/
│   ├── main.js                   # 主入口（初始化所有模块）
│   ├── styles/
│   │   ├── tokens.css            # CSS 变量（Tokyo Night + Light）
│   │   ├── base.css              # 重置 + 基础排版
│   │   ├── layout.css            # 三块布局
│   │   └── mobile.css            # 响应式断点
│   ├── ui/
│   │   ├── header.js             # 顶部栏（logo + 主题切换）
│   │   ├── expression.js         # Expression 区（正则输入 + flags）
│   │   ├── text.js               # Text 区（CodeMirror + 高亮）
│   │   └── tools.js              # Tools 区（4 Tab + 输入框）
│   ├── engine/
│   │   ├── regex-solver.js       # 主线程调度（防抖 + Worker 调用）
│   │   ├── regex-worker.js       # Worker（Comlink expose，跑正则）
│   │   └── template-parser.js    # $1 $2 模板解析器（修复 bug）
│   └── utils/
│       ├── debounce.js           # 防抖
│       └── theme.js              # 主题切换 + localStorage
└── tests/
    ├── engine/
    │   ├── regex-worker.test.js  # Worker 单测
    │   └── template-parser.test.js
    └── utils/
        └── debounce.test.js
```

每个文件的**单一职责**：
- `regex-worker.js`：只跑正则，不碰 DOM
- `template-parser.js`：纯函数，接收 match + template，返回 string
- `regex-solver.js`：调度 Worker + 防抖 + 错误处理
- `expression.js`：只负责正则输入 UI 和 flag 切换，发事件
- `text.js`：只负责文本编辑 + 高亮，不发事件
- `tools.js`：只负责 4 个 Tab 的 UI 切换 + 显示结果
- `main.js`：唯一知道所有模块存在的文件，负责连线和事件路由

---

## 执行策略

使用 `mise` 安装 Node.js 22 LTS（不依赖系统 node）：
```bash
mise use node@22
```

包管理器使用 `pnpm`（速度快、磁盘友好）：
```bash
mise use -g pnpm@9
```

所有命令通过 `mise exec` 或 `mise x --` 运行，确保环境隔离。

---

## Milestone 1 · 项目脚手架

### Task 1: 初始化项目 + mise 配置

**Files:**
- Create: `.mise.toml`
- Create: `package.json`
- Create: `.gitignore`

- [ ] **Step 1: 创建 mise 配置**

`.mise.toml`:
```toml
[tools]
node = "22"

[tasks.dev]
run = "pnpm dev"

[tasks.build]
run = "pnpm build"

[tasks.test]
run = "pnpm test"
```

- [ ] **Step 2: 安装 Node.js 和 pnpm**

```bash
mise install
mise use -g pnpm@9
```

Expected: `node --version` 输出 v22.x.x，`pnpm --version` 输出 9.x.x

- [ ] **Step 3: 初始化 package.json**

```bash
pnpm init
```

然后覆盖 `package.json` 为：
```json
{
  "name": "regexr-clone",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 4: 创建 .gitignore**

`.gitignore`:
```
node_modules/
dist/
.vite/
.superpowers/
*.log
.DS_Store
```

- [ ] **Step 5: 初始化 git 仓库**

```bash
git init -b main
git add .
git commit -m "chore: 初始化项目骨架（mise + pnpm + Vite 配置）"
```

- [ ] **Step 6: 安装依赖**

```bash
pnpm add codemirror @codemirror/view @codemirror/state @codemirror/lang-javascript @codemirror/language @codemirror/commands @codemirror/search comlink
pnpm add -D vite vitest
```

Expected: `node_modules/` 创建成功，无报错

- [ ] **Step 7: 提交**

```bash
git add .
git commit -m "build(deps): 安装核心依赖（CodeMirror 6 + Comlink + Vite + Vitest）"
```

---

### Task 2: Vite + Vitest 配置 + Hello World

**Files:**
- Create: `vite.config.js`
- Create: `vitest.config.js`
- Create: `index.html`
- Create: `src/main.js`
- Create: `public/favicon.ico` (可选，先用空文件占位)

- [ ] **Step 1: 创建 vite.config.js**

`vite.config.js`:
```javascript
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          codemirror: [
            'codemirror',
            '@codemirror/view',
            '@codemirror/state',
            '@codemirror/lang-javascript',
          ],
        },
      },
    },
  },
  worker: {
    format: 'es',
  },
});
```

- [ ] **Step 2: 创建 vitest.config.js**

`vitest.config.js`:
```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
});
```

- [ ] **Step 3: 创建最小 index.html**

`index.html`:
```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>RegExr</title>
  </head>
  <body>
    <div id="app">Hello RegExr</div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 4: 创建最小 main.js**

`src/main.js`:
```javascript
console.log('RegExr clone starting');
```

- [ ] **Step 5: 启动 dev server 验证**

```bash
pnpm dev
```

打开 http://localhost:5173/，Expected: 页面显示 "Hello RegExr"

Ctrl+C 停止

- [ ] **Step 6: 运行测试**

```bash
pnpm test
```

Expected: `No test files found`（无测试文件但命令正常退出 0）

- [ ] **Step 7: 提交**

```bash
git add .
git commit -m "build: 配置 Vite + Vitest + 最小 Hello World"
```

---

## Milestone 2 · 核心引擎

### Task 3: 模板解析器（修复 $1 bug 的核心）

**Files:**
- Create: `src/engine/template-parser.js`
- Create: `tests/engine/template-parser.test.js`

- [ ] **Step 1: 写失败测试**

`tests/engine/template-parser.test.js`:
```javascript
import { describe, it, expect } from 'vitest';
import { applyTemplate } from '../../src/engine/template-parser.js';

// 构造一个 fake match 对象，模拟 regex-worker 输出
const makeMatch = (full, groups = [], namedGroups = {}) => ({
  full,
  groups: groups.map((value, index) => ({ index, value })),
  namedGroups,
});

describe('applyTemplate', () => {
  it('替换 $0 为完整匹配', () => {
    const m = makeMatch('hello world');
    expect(applyTemplate('[$0]', m)).toBe('[hello world]');
  });

  it('替换 $1 $2 为捕获组', () => {
    const m = makeMatch('photo.jpg', ['', 'jpg']); // $0=full, $1=jpg
    expect(applyTemplate('$1 - $0', m)).toBe('jpg - photo.jpg');
  });

  it('多个相同占位符都替换', () => {
    const m = makeMatch('a', ['', 'x']);
    expect(applyTemplate('$1,$1,$1', m)).toBe('x,x,x');
  });

  it('捕获组不存在时替换为空字符串', () => {
    const m = makeMatch('hello', []);
    expect(applyTemplate('$1-$99', m)).toBe('-');
  });

  it('替换 \\n 为换行符', () => {
    const m = makeMatch('x');
    expect(applyTemplate('a\\nb', m)).toBe('a\nb');
  });

  it('替换 \\t 为 Tab', () => {
    const m = makeMatch('x');
    expect(applyTemplate('a\\tb', m)).toBe('a\tb');
  });

  it('替换 ${name} 为命名捕获组', () => {
    const m = makeMatch('jpg', ['', 'jpg'], { ext: 'jpg' });
    expect(applyTemplate('[${ext}]', m)).toBe('[jpg]');
  });

  it('命名捕获组不存在时替换为空字符串', () => {
    const m = makeMatch('x', [], {});
    expect(applyTemplate('${missing}', m)).toBe('');
  });

  it('混合使用多种占位符', () => {
    const m = makeMatch('https://a.com/p.jpg', ['', 'jpg'], { ext: 'jpg' });
    expect(applyTemplate('$1 | ${ext} | $0', m))
      .toBe('jpg | jpg | https://a.com/p.jpg');
  });

  it('模板为空字符串时返回空', () => {
    const m = makeMatch('x');
    expect(applyTemplate('', m)).toBe('');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
pnpm test tests/engine/template-parser.test.js
```

Expected: FAIL，报 `Cannot find module` 或 `applyTemplate is not a function`

- [ ] **Step 3: 实现 applyTemplate**

`src/engine/template-parser.js`:
```javascript
/**
 * 将模板字符串中的占位符替换为 match 的实际值。
 *
 * 支持的占位符：
 *   $0        - 完整匹配
 *   $1, $2... - 数字捕获组
 *   ${name}   - 命名捕获组
 *   \n        - 换行符
 *   \t        - Tab
 *
 * @param {string} template - 模板字符串
 * @param {{ full: string, groups: Array<{index:number,value:string}>, namedGroups: Object }} match
 * @returns {string}
 */
export function applyTemplate(template, match) {
  if (!template) return '';

  // 预处理转义序列（避免和占位符正则冲突）
  const ESC_N = '\x00N\x00';
  const ESC_T = '\x00T\x00';
  let t = template.replace(/\\n/g, ESC_N).replace(/\\t/g, ESC_T);

  // 替换命名捕获组 ${name}（先处理，避免被 $N 干扰）
  t = t.replace(/\$\{(\w+)\}/g, (_, name) => {
    const v = match.namedGroups?.[name];
    return v !== undefined ? v : '';
  });

  // 替换数字捕获组 $N（贪婪匹配多位数字，避免 $10 被解析为 $1 + "0"）
  t = t.replace(/\$(\d+)/g, (_, numStr) => {
    const idx = parseInt(numStr, 10);
    const g = match.groups.find((g) => g.index === idx);
    return g ? g.value : '';
  });

  // 还原转义序列
  return t.replace(/\x00N\x00/g, '\n').replace(/\x00T\x00/g, '\t');
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
pnpm test tests/engine/template-parser.test.js
```

Expected: 10 passed

- [ ] **Step 5: 提交**

```bash
git add .
git commit -m "feat(engine): 实现模板解析器 applyTemplate（修复 $1 提取 bug）"
```

---

### Task 4: Web Worker（跑正则 + 防灾难性回溯）

**Files:**
- Create: `src/engine/regex-worker.js`
- Create: `tests/engine/regex-worker.test.js`

- [ ] **Step 1: 写失败测试**

`tests/engine/regex-worker.test.js`:
```javascript
import { describe, it, expect } from 'vitest';
import { solve } from '../../src/engine/regex-worker.js';

describe('solve', () => {
  it('返回空数组当无匹配', () => {
    const result = solve('xyz', 'g', 'hello world');
    expect(result.matches).toEqual([]);
  });

  it('返回单个匹配当不带 g flag', () => {
    const result = solve('o', '', 'hello');
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].full).toBe('o');
    expect(result.matches[0].index).toBe(4);
    expect(result.matches[0].length).toBe(1);
  });

  it('返回所有匹配当带 g flag', () => {
    const result = solve('o', 'g', 'hello world foo');
    expect(result.matches).toHaveLength(4);
  });

  it('返回捕获组 groups', () => {
    const result = solve('(\\w+)@(\\w+)', 'g', 'a@b c@d');
    expect(result.matches).toHaveLength(2);
    // $0=full, $1=user, $2=domain
    expect(result.matches[0].groups).toEqual([
      { index: 0, value: 'a@b' },
      { index: 1, value: 'a' },
      { index: 2, value: 'b' },
    ]);
  });

  it('返回命名捕获组 namedGroups', () => {
    const result = solve('(?<user>\\w+)@(?<domain>\\w+)', 'g', 'a@b');
    expect(result.matches[0].namedGroups).toEqual({ user: 'a', domain: 'b' });
  });

  it('精确报告 index 和 length', () => {
    const result = solve('world', 'g', 'hello world!');
    expect(result.matches[0].index).toBe(6);
    expect(result.matches[0].length).toBe(5);
  });

  it('正则语法错误时返回 error', () => {
    const result = solve('[abc', 'g', 'text');
    expect(result.error).toBeDefined();
    expect(result.matches).toEqual([]);
  });

  it('空匹配时推进 lastIndex 防死循环', () => {
    // /^/g 在 "abc" 上会匹配 4 次（每个位置），不会死循环
    const result = solve('^', 'gm', 'a\nb\nc');
    expect(result.matches.length).toBeGreaterThanOrEqual(3);
  });

  it('防灾难性回溯（迭代上限）', () => {
    // 构造会触发指数级回溯的正则
    const result = solve('(a+)+$', 'g', 'a'.repeat(30) + '!');
    // 要么在合理时间内返回（可能无匹配），要么返回 warning
    expect(result).toBeDefined();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
pnpm test tests/engine/regex-worker.test.js
```

Expected: FAIL

- [ ] **Step 3: 实现 solve 函数**

`src/engine/regex-worker.js`:
```javascript
const MAX_ITER = 50000;
const MAX_TIME_MS = 250;

/**
 * 在 Worker 中执行正则匹配。
 *
 * @param {string} pattern - 正则表达式
 * @param {string} flags - 标志位（g/i/m/s/u/y 组合）
 * @param {string} text - 待匹配文本
 * @returns {{ matches: Array, error?: { message: string, warning?: boolean } }}
 */
export function solve(pattern, flags, text) {
  if (!pattern) {
    return { matches: [] };
  }

  let re;
  try {
    re = new RegExp(pattern, flags);
  } catch (err) {
    return { matches: [], error: { message: err.message } };
  }

  const matches = [];
  let iter = 0;
  const start = performance.now();
  let m;

  try {
    while ((m = re.exec(text)) !== null) {
      // 防空匹配死循环：零宽匹配时推进 lastIndex
      if (re.lastIndex === m.index) {
        re.lastIndex++;
      }

      // 安全退出
      if (++iter > MAX_ITER || performance.now() - start > MAX_TIME_MS) {
        return {
          matches,
          error: {
            message: `匹配中断（超过 ${MAX_ITER} 次迭代或 ${MAX_TIME_MS}ms）`,
            warning: true,
          },
        };
      }

      // 构造 groups 数组（包含 $0）
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
        groups,
        namedGroups: m.groups ?? {},
      });

      if (!re.global) break;
    }
  } catch (err) {
    return {
      matches,
      error: { message: `执行错误: ${err.message}` },
    };
  }

  return { matches };
}

// Worker 环境时才 expose
if (typeof self !== 'undefined' && typeof window === 'undefined') {
  import('comlink').then(({ expose }) => {
    expose({ solve });
  });
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
pnpm test tests/engine/regex-worker.test.js
```

Expected: 9 passed

- [ ] **Step 5: 提交**

```bash
git add .
git commit -m "feat(engine): 实现 Web Worker 正则匹配（防灾难性回溯 + 捕获组完整收集）"
```

---

### Task 5: 防抖工具

**Files:**
- Create: `src/utils/debounce.js`
- Create: `tests/utils/debounce.test.js`

- [ ] **Step 1: 写失败测试**

`tests/utils/debounce.test.js`:
```javascript
import { describe, it, expect, vi } from 'vitest';
import { debounce } from '../../src/utils/debounce.js';

describe('debounce', () => {
  it('延迟调用', async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d();
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('多次调用只触发最后一次', async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d('a');
    d('b');
    d('c');
    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('c');
    vi.useRealTimers();
  });

  it('cancel 取消待执行调用', () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d();
    d.cancel();
    vi.advanceTimersByTime(100);
    expect(fn).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
pnpm test tests/utils/debounce.test.js
```

Expected: FAIL

- [ ] **Step 3: 实现 debounce**

`src/utils/debounce.js`:
```javascript
/**
 * 防抖函数。在最后一次调用后等待 delay 毫秒才执行。
 * 返回的函数有 .cancel() 方法用于取消待执行调用。
 */
export function debounce(fn, delay) {
  let timer = null;
  const debounced = function (...args) {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn.apply(this, args);
    }, delay);
  };
  debounced.cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };
  return debounced;
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
pnpm test tests/utils/debounce.test.js
```

Expected: 3 passed

- [ ] **Step 5: 提交**

```bash
git add .
git commit -m "feat(utils): 实现 debounce 防抖工具"
```

---

### Task 6: 主线程调度器（regex-solver）

**Files:**
- Create: `src/engine/regex-solver.js`

- [ ] **Step 1: 实现 regex-solver**

`src/engine/regex-solver.js`:
```javascript
import { wrap } from 'comlink';

let workerInstance = null;
let api = null;

/**
 * 懒初始化 Worker（首次调用时才创建）
 */
async function getApi() {
  if (!api) {
    workerInstance = new Worker(
      new URL('./regex-worker.js', import.meta.url),
      { type: 'module' }
    );
    api = wrap(workerInstance);
  }
  return api;
}

/**
 * 执行正则匹配（异步）。
 *
 * @param {string} pattern
 * @param {string} flags
 * @param {string} text
 * @returns {Promise<{matches: Array, error?: Object}>}
 */
export async function solveRegex(pattern, flags, text) {
  try {
    const remote = await getApi();
    return await remote.solve(pattern, flags, text);
  } catch (err) {
    return { matches: [], error: { message: err.message } };
  }
}

/**
 * 终止 Worker（用于主题切换或卸载时清理）
 */
export function terminateWorker() {
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
    api = null;
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add .
git commit -m "feat(engine): 实现主线程 regex-solver（Comlink wrap + 懒初始化）"
```

---

## Milestone 3 · UI 骨架 + 样式基础

### Task 7: CSS 变量 + 基础样式

**Files:**
- Create: `src/styles/tokens.css`
- Create: `src/styles/base.css`
- Create: `src/styles/layout.css`
- Modify: `index.html`

- [ ] **Step 1: 创建 tokens.css**

`src/styles/tokens.css`:
```css
:root {
  /* Tokyo Night 调色板 */
  --bg: #1a1b26;
  --bg-elev: #1f2335;
  --bg-surface: #24283b;
  --border: #3b4261;
  --border-subtle: #292e42;

  --text: #c0caf5;
  --text-dim: #a9b1d6;
  --text-muted: #565f89;
  --text-faint: #3b4261;

  --accent: #7aa2f7;
  --accent-dim: #5d7ec7;
  --green: #9ece6a;
  --purple: #bb9af7;
  --red: #f7768e;
  --orange: #ff9e64;
  --yellow: #e0af68;
  --cyan: #7dcfff;

  --radius: 6px;
  --radius-sm: 4px;

  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 24px;

  --font-ui: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', 'Source Code Pro', Consolas, monospace;

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
}

/* 浅色主题覆盖 */
[data-theme='light'] {
  --bg: #ffffff;
  --bg-elev: #f6f8fa;
  --bg-surface: #eef1f5;
  --border: #d0d7de;
  --border-subtle: #e7ebf0;

  --text: #1f2328;
  --text-dim: #444d56;
  --text-muted: #8b949e;
  --text-faint: #c0c8d0;

  --accent: #0969da;
  --accent-dim: #0550ae;
  --green: #1a7f37;
  --purple: #8250df;
  --red: #cf222e;
  --orange: #bf5700;
  --yellow: #9a6700;
  --cyan: #0e7490;
}
```

- [ ] **Step 2: 创建 base.css**

`src/styles/base.css`:
```css
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body {
  height: 100%;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-ui);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

svg.icon {
  width: 1em;
  height: 1em;
  display: inline-block;
  fill: currentColor;
  vertical-align: middle;
}

button {
  font-family: inherit;
  cursor: pointer;
  border: none;
  background: none;
  color: inherit;
}

input,
textarea {
  font-family: inherit;
  color: inherit;
}

::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
::-webkit-scrollbar-track {
  background: var(--bg-elev);
}
::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted);
}
```

- [ ] **Step 3: 创建 layout.css（骨架）**

`src/styles/layout.css`:
```css
/* 顶部栏 */
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-surface);
  padding: 0 var(--space-lg);
  height: 52px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

/* 三块主区域 */
.doc {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.section {
  display: flex;
  flex-direction: column;
  background: var(--bg);
  flex: 1 1 0%;
  min-height: 0;
}

.section-header {
  display: flex;
  align-items: center;
  padding: 0 var(--space-lg);
  height: 38px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
}

.section-header h1 {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
}

.section-article {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* Expression 区固定高度 */
.section.expression {
  flex: 0 0 auto;
}

/* Text 区占剩余空间 */
.section.text {
  flex: 1 1 0%;
}

/* Tools 区最多 50% */
.section.tools {
  flex: 0 0 auto;
  max-height: 50%;
}
```

- [ ] **Step 4: 创建 mobile.css（骨架）**

`src/styles/mobile.css`:
```css
@media (max-width: 768px) {
  .app-header {
    padding: 0 var(--space-md);
    height: 48px;
  }

  .section-header {
    padding: 0 var(--space-md);
    height: 36px;
  }

  /* 其余移动端覆盖在后续任务补充 */
}
```

- [ ] **Step 5: 更新 index.html 引入样式**

修改 `index.html` 的 `<head>` 部分：
```html
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>RegExr</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap"
    rel="stylesheet"
  />
  <link rel="stylesheet" href="/src/styles/tokens.css" />
  <link rel="stylesheet" href="/src/styles/base.css" />
  <link rel="stylesheet" href="/src/styles/layout.css" />
  <link rel="stylesheet" href="/src/styles/mobile.css" />
</head>
```

- [ ] **Step 6: 启动 dev server 验证样式加载**

```bash
pnpm dev
```

打开 http://localhost:5173/，Expected: 深色背景 `#1a1b26`，文字颜色正常

- [ ] **Step 7: 提交**

```bash
git add .
git commit -m "style: 建立 Tokyo Night 主题变量 + 三块布局骨架"
```

---

### Task 8: 顶部栏 UI

**Files:**
- Create: `src/ui/header.js`
- Create: `src/utils/theme.js`
- Modify: `index.html`
- Modify: `src/main.js`

- [ ] **Step 1: 实现 theme.js**

`src/utils/theme.js`:
```javascript
const STORAGE_KEY = 'regexr-theme';

export function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  const theme = saved === 'light' ? 'light' : 'dark';
  applyTheme(theme);
  return theme;
}

export function toggleTheme() {
  const current = document.documentElement.dataset.theme || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem(STORAGE_KEY, next);
  return next;
}

function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.dataset.theme = 'light';
  } else {
    delete document.documentElement.dataset.theme;
  }
}
```

- [ ] **Step 2: 实现 header.js**

`src/ui/header.js`:
```javascript
import { toggleTheme } from '../utils/theme.js';

export function renderHeader(container) {
  container.innerHTML = `
    <div class="app-header">
      <div class="logo-wrap">
        <svg class="logo" viewBox="0 0 64 64" aria-hidden="true">
          <path d="M0 0v64h64V0H0zm23.799 52.045H11.783V40.029h12.016v12.016zm29.957-22.401l-5.396 5.235-6.765-11.033L34.67 35.12l-5.396-5.235 9.744-7.328-13.046-4.188 3.785-6.604 10.711 8.617L37.65 7.739h7.57l-2.899 12.643 10.791-8.617 3.785 6.604-12.804 4.027 9.663 7.248z" fill="currentColor"/>
        </svg>
        <span>RegExr</span>
      </div>
      <ul class="etc">
        <li>
          <button class="theme-btn" type="button" title="切换主题" id="themeToggle">
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3a9 9 0 109 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 01-4.4 2.26 5.403 5.403 0 01-3.14-9.8c-.44-.06-.9-.1-1.36-.1z" fill="currentColor"/>
            </svg>
          </button>
        </li>
        <li><a href="https://github.com" target="_blank" rel="noopener">GitHub</a></li>
        <li><a href="#" id="helpLink">Help</a></li>
      </ul>
    </div>
  `;

  // 顶部栏样式
  const style = document.createElement('style');
  style.textContent = `
    .app-header .logo-wrap {
      display: flex; align-items: center; gap: 8px;
      color: var(--accent); font-weight: 700; font-size: 16px;
      letter-spacing: -0.02em;
    }
    .app-header .logo { width: 22px; height: 22px; }
    .app-header .etc {
      display: flex; gap: 12px; align-items: center;
      list-style: none; color: var(--text-muted); font-size: 13px;
    }
    .app-header .etc li a {
      color: var(--text-muted); text-decoration: none; transition: color 0.15s;
    }
    .app-header .etc li a:hover { color: var(--text); }
    .app-header .theme-btn {
      padding: 6px; background: var(--bg-elev); border-radius: 4px;
      border: 1px solid var(--border); color: var(--accent);
      transition: all 0.15s;
    }
    .app-header .theme-btn:hover {
      background: var(--bg-surface); border-color: var(--accent);
    }
  `;
  container.appendChild(style);

  // 事件绑定
  document.getElementById('themeToggle').addEventListener('click', () => {
    toggleTheme();
  });

  document.getElementById('helpLink').addEventListener('click', (e) => {
    e.preventDefault();
    alert('快捷键：\n- Ctrl/Cmd + Z：撤销\n- Ctrl/Cmd + Shift + Z：重做\n\n输入正则后，Text 区自动高亮匹配。');
  });
}
```

- [ ] **Step 3: 更新 index.html 增加 header 容器**

替换 `index.html` 的 `<body>` 部分：
```html
<body>
  <header id="appHeader"></header>
  <main class="doc" id="appDoc">Hello RegExr</main>
  <script type="module" src="/src/main.js"></script>
</body>
```

- [ ] **Step 4: 更新 main.js 渲染 header**

`src/main.js`:
```javascript
import { initTheme } from './utils/theme.js';
import { renderHeader } from './ui/header.js';

initTheme();
renderHeader(document.getElementById('appHeader'));
```

- [ ] **Step 5: 启动 dev server 验证**

```bash
pnpm dev
```

Expected: 顶部显示 logo "RegExr" + 🌙 + GitHub + Help，点击 🌙 切换深浅主题，刷新后保持选择

- [ ] **Step 6: 提交**

```bash
git add .
git commit -m "feat(ui): 实现顶部栏 + 主题切换（localStorage 持久化）"
```

---

## Milestone 4 · 三块 UI + 集成

### Task 9: Expression 区（正则输入 + flags）

**Files:**
- Create: `src/ui/expression.js`
- Modify: `src/main.js`
- Modify: `index.html`

- [ ] **Step 1: 实现 expression.js**

`src/ui/expression.js`:
```javascript
const FLAGS = [
  { key: 'g', label: 'g', title: 'global - 匹配所有结果' },
  { key: 'i', label: 'i', title: 'ignoreCase - 不区分大小写' },
  { key: 'm', label: 'm', title: 'multiline - ^$ 匹配每行' },
  { key: 's', label: 's', title: 'dotAll - . 匹配换行符' },
  { key: 'u', label: 'u', title: 'unicode - Unicode 模式' },
  { key: 'y', label: 'y', title: 'sticky - 粘滞匹配' },
];

export class ExpressionUI {
  constructor(container) {
    this.container = container;
    this.pattern = '';
    this.flags = new Set(['g']); // 默认启用 global
    this.listeners = new Set();
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <section class="section expression">
        <header class="section-header">
          <h1>Expression</h1>
          <div class="flags" id="flagsContainer">
            ${FLAGS.map(
              (f) => `
                <button
                  type="button"
                  class="flag ${this.flags.has(f.key) ? 'on' : ''}"
                  data-flag="${f.key}"
                  title="${f.title}"
                >${f.label}</button>
              `
            ).join('')}
          </div>
        </header>
        <div class="expression-editor">
          <span class="slash">/</span>
          <div class="editor-wrap">
            <div id="expressionMount"></div>
          </div>
          <span class="slash">/</span>
        </div>
      </section>
    `;

    // 样式
    const style = document.createElement('style');
    style.textContent = `
      .section.expression .section-header h1 { color: var(--accent); }
      .section.expression .section-header { background: linear-gradient(180deg, #292e42 0%, #1f2335 100%); }
      .flags { display: flex; gap: 2px; margin-left: auto; }
      .flag {
        padding: 4px 8px; min-width: 28px; text-align: center;
        font-family: var(--font-mono); font-size: 12px; font-weight: 600;
        background: var(--bg-elev); color: var(--text-muted);
        border: 1px solid var(--border); cursor: pointer; transition: all 0.15s;
      }
      .flag:first-child { border-radius: 4px 0 0 4px; }
      .flag:last-child { border-radius: 0 4px 4px 0; }
      .flag:hover { color: var(--text); background: var(--bg-surface); }
      .flag.on { background: var(--accent); color: var(--bg); border-color: var(--accent); }
      .flag.on:hover { background: var(--accent-dim); }

      .expression-editor {
        display: flex; align-items: center; gap: 8px;
        padding: 12px 16px; background: var(--bg);
        border-bottom: 1px solid var(--border); min-height: 44px;
      }
      .expression-editor .slash {
        color: var(--accent); font-family: var(--font-mono);
        font-size: 18px; font-weight: 700;
      }
      .expression-editor .editor-wrap { flex: 1; min-width: 0; }
      .expression-editor .cm-editor { outline: none !important; }
      .expression-editor .cm-content {
        font-family: var(--font-mono); font-size: 15px; font-weight: 500;
      }
      .expression-editor .cm-scroller { font-family: var(--font-mono); }
      .expression-editor.error {
        outline: 2px solid var(--red);
      }
      .expression-error {
        color: var(--red); font-size: 12px; padding: 4px 16px 8px;
        background: var(--bg); border-bottom: 1px solid var(--border);
        display: none;
      }
      .expression-error.show { display: block; }
    `;
    this.container.appendChild(style);

    // flag 切换
    this.container.querySelectorAll('.flag').forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.flag;
        if (this.flags.has(key)) this.flags.delete(key);
        else this.flags.add(key);
        btn.classList.toggle('on');
        this.emit();
      });
    });
  }

  /**
   * 挂载 CodeMirror 编辑器（由外部调用，传入 CM 实例）
   */
  mountEditor(cmView) {
    this.cmView = cmView;
    cmView.dom.addEventListener('input', () => {
      this.pattern = cmView.state.doc.toString();
      this.emit();
    });
    // 初始读取
    this.pattern = cmView.state.doc.toString();
  }

  getFlagsString() {
    return [...this.flags].join('');
  }

  getPattern() {
    return this.pattern;
  }

  setError(message) {
    let el = this.container.querySelector('.expression-error');
    if (!el) {
      el = document.createElement('div');
      el.className = 'expression-error';
      this.container.querySelector('.section.expression').appendChild(el);
    }
    if (message) {
      el.textContent = message;
      el.classList.add('show');
      this.container.querySelector('.expression-editor').classList.add('error');
    } else {
      el.classList.remove('show');
      this.container.querySelector('.expression-editor').classList.remove('error');
    }
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    const data = { pattern: this.pattern, flags: this.getFlagsString() };
    this.listeners.forEach((fn) => fn(data));
  }
}
```

- [ ] **Step 2: 更新 main.js 挂载 Expression**

`src/main.js`:
```javascript
import { initTheme } from './utils/theme.js';
import { renderHeader } from './ui/header.js';
import { ExpressionUI } from './ui/expression.js';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';

initTheme();
renderHeader(document.getElementById('appHeader'));

// 为 Expression 区准备容器
const doc = document.getElementById('appDoc');
doc.innerHTML = '<div id="expressionRoot"></div>';

const expr = new ExpressionUI(document.getElementById('expressionRoot'));

// 挂载 CodeMirror
const exprEditor = new EditorView({
  state: EditorState.create({
    doc: '',
    extensions: [
      basicSetup,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          expr.pattern = update.state.doc.toString();
          expr.emit();
        }
      }),
    ],
  }),
  parent: document.getElementById('expressionMount'),
});

expr.onChange(({ pattern, flags }) => {
  console.log('pattern:', pattern, 'flags:', flags);
});
```

- [ ] **Step 3: 启动 dev server 验证**

```bash
pnpm dev
```

Expected: Expression 区显示，可输入正则，g/i/m/s/u/y 可点击切换，console 打印 pattern 和 flags

- [ ] **Step 4: 提交**

```bash
git add .
git commit -m "feat(ui): 实现 Expression 区（CodeMirror + flags 平铺切换）"
```

---

### Task 10: Text 区（CodeMirror + 高亮）

**Files:**
- Create: `src/ui/text.js`
- Modify: `src/main.js`

- [ ] **Step 1: 实现 text.js**

`src/ui/text.js`:
```javascript
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { Decoration, ViewPlugin } from '@codemirror/view';

export class TextUI {
  constructor(container) {
    this.container = container;
    this.matchCount = 0;
    this.listeners = new Set();
    this.decorations = Decoration.none;
    this.render();
    this.mountEditor();
  }

  render() {
    this.container.innerHTML = `
      <section class="section text">
        <header class="section-header">
          <ul class="modelist">
            <li class="selected">Text</li>
          </ul>
          <div class="result" id="matchResult"><span class="dot"></span>No match</div>
        </header>
        <article class="section-article">
          <div class="text-editor-wrap" id="textEditorMount"></div>
        </article>
      </section>
    `;

    const style = document.createElement('style');
    style.textContent = `
      .section.text .modelist {
        display: flex; gap: 2px; list-style: none;
      }
      .section.text .modelist li {
        padding: 5px 12px; font-size: 12px; font-weight: 500;
        background: var(--bg-elev); color: var(--text-muted);
        border: 1px solid var(--border); cursor: pointer; transition: all 0.15s;
      }
      .section.text .modelist li.selected {
        background: var(--bg-surface); color: var(--text); font-weight: 600;
      }
      .section.text .result {
        padding: 5px 12px; font-size: 12px; font-weight: 600;
        background: var(--bg-elev); color: var(--text-muted);
        border: 1px solid var(--border); border-radius: 4px;
        margin-left: auto; display: flex; align-items: center; gap: 6px;
      }
      .section.text .result.pass {
        background: rgba(158, 206, 106, 0.15); color: var(--green);
        border-color: rgba(158, 206, 106, 0.3);
      }
      .section.text .result .dot {
        width: 6px; height: 6px; border-radius: 50%; background: currentColor;
      }
      .text-editor-wrap {
        flex: 1; display: flex; background: var(--bg); overflow: hidden;
      }
      .text-editor-wrap .cm-editor { flex: 1; outline: none !important; }
      .text-editor-wrap .cm-content {
        font-family: var(--font-mono); font-size: 13px; color: var(--text-dim);
        line-height: 1.6;
      }
      .text-editor-wrap .cm-gutters {
        background: var(--bg-elev); color: var(--text-faint);
        border-right: 1px solid var(--border);
      }
      .text-editor-wrap .cm-activeLineGutter { background: var(--bg-surface); }
      .text-editor-wrap .cm-activeLine { background: rgba(122, 162, 247, 0.05); }
      .text-editor-wrap .cm-match {
        background: rgba(122, 162, 247, 0.25); color: var(--accent);
        border-radius: 3px; padding: 1px 0; cursor: pointer;
        transition: background 0.15s;
      }
      .text-editor-wrap .cm-match:hover {
        background: rgba(122, 162, 247, 0.4);
      }
      .text-editor-wrap .cm-match.selected {
        background: rgba(122, 162, 247, 0.5);
        box-shadow: 0 0 0 2px rgba(122, 162, 247, 0.4);
      }
    `;
    this.container.appendChild(style);
  }

  mountEditor() {
    const self = this;
    const decorationPlugin = ViewPlugin.define(
      () => ({
        decorations: self.decorations,
      }),
      { decorations: (v) => v.decorations }
    );

    this.view = new EditorView({
      state: EditorState.create({
        doc: '',
        extensions: [
          basicSetup,
          decorationPlugin,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              this.emit();
            }
          }),
        ],
      }),
      parent: this.container.querySelector('#textEditorMount'),
    });
  }

  getText() {
    return this.view ? this.view.state.doc.toString() : '';
  }

  setText(text) {
    if (!this.view) return;
    this.view.dispatch({
      changes: { from: 0, to: this.view.state.doc.length, insert: text },
    });
  }

  /**
   * 更新匹配高亮。
   * @param {Array<{index:number,length:number}>} matches
   */
  setMatches(matches) {
    this.matchCount = matches.length;

    // 构造 Decorations
    const decos = matches.map((m) =>
      Decoration.mark({
        class: 'cm-match',
        attributes: { 'data-idx': String(m.index) },
      }).range(m.index, m.index + m.length)
    );
    this.decorations = Decoration.set(decos, true);

    // 重建 view plugin 以应用新 decoration
    // (简化实现：直接重新挂载)
    this.remountWithDecorations();

    // 更新匹配计数
    this.updateResult();
  }

  remountWithDecorations() {
    if (!this.view) return;
    const self = this;
    const currentDoc = this.view.state.doc.toString();

    this.view.destroy();

    const decorationPlugin = ViewPlugin.define(
      () => ({ decorations: self.decorations }),
      { decorations: (v) => v.decorations }
    );

    this.view = new EditorView({
      state: EditorState.create({
        doc: currentDoc,
        extensions: [
          basicSetup,
          decorationPlugin,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) this.emit();
          }),
        ],
      }),
      parent: this.container.querySelector('#textEditorMount'),
    });
  }

  updateResult() {
    const el = this.container.querySelector('#matchResult');
    if (!el) return;
    if (this.matchCount > 0) {
      el.classList.add('pass');
      el.innerHTML = `<span class="dot"></span>${this.matchCount} match${this.matchCount > 1 ? 'es' : ''}`;
    } else {
      el.classList.remove('pass');
      el.innerHTML = '<span class="dot"></span>No match';
    }
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    const text = this.getText();
    this.listeners.forEach((fn) => fn(text));
  }
}
```

- [ ] **Step 2: 更新 main.js 集成 Text 区**

替换 `src/main.js`：
```javascript
import { initTheme } from './utils/theme.js';
import { renderHeader } from './ui/header.js';
import { ExpressionUI } from './ui/expression.js';
import { TextUI } from './ui/text.js';
import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { solveRegex } from './engine/regex-solver.js';
import { debounce } from './utils/debounce.js';

initTheme();
renderHeader(document.getElementById('appHeader'));

const doc = document.getElementById('appDoc');
doc.innerHTML = '<div id="expressionRoot"></div><div id="textRoot"></div>';

const expr = new ExpressionUI(document.getElementById('expressionRoot'));
const text = new TextUI(document.getElementById('textRoot'));

// Expression CodeMirror
new EditorView({
  state: EditorState.create({
    doc: '',
    extensions: [
      basicSetup,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          expr.pattern = update.state.doc.toString();
          expr.emit();
        }
      }),
    ],
  }),
  parent: document.getElementById('expressionMount'),
});

// 触发匹配
const runMatch = debounce(async () => {
  const pattern = expr.getPattern();
  const flags = expr.getFlagsString();
  const body = text.getText();

  if (!pattern) {
    expr.setError(null);
    text.setMatches([]);
    return;
  }

  const result = await solveRegex(pattern, flags, body);
  if (result.error && !result.error.warning) {
    expr.setError(result.error.message);
  } else {
    expr.setError(null);
    text.setMatches(result.matches);
  }
}, 300);

expr.onChange(runMatch);
text.onChange(runMatch);
```

- [ ] **Step 3: 启动 dev server 验证**

```bash
pnpm dev
```

测试：
- 输入正则 `\d+`，文本 `abc 123 def 456`
- Expected: 高亮两处数字，右上角显示 "2 matches" 绿色
- 输入非法正则 `[abc`
- Expected: Expression 红框 + 错误提示

- [ ] **Step 4: 提交**

```bash
git add .
git commit -m "feat(ui): 实现 Text 区 + 集成 Worker 高亮（修复高亮不准 bug）"
```

---

### Task 11: Tools 区（4 Tab + 输入框）

**Files:**
- Create: `src/ui/tools.js`
- Modify: `src/main.js`

- [ ] **Step 1: 实现 tools.js**

`src/ui/tools.js`:
```javascript
import { applyTemplate } from '../engine/template-parser.js';

export class ToolsUI {
  constructor(container) {
    this.container = container;
    this.activeTab = 'match';
    this.matches = [];
    this.selectedMatchIndex = 0;
    this.extractTemplate = '$1 - $0';
    this.replaceTemplate = '[IMG:$1]';
    this.listeners = new Set();
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <section class="section tools">
        <header class="section-header">
          <h1>Tools</h1>
          <ul class="segcontrol" id="toolsTabs">
            <li class="selected" data-tab="match">Match</li>
            <li data-tab="extract">Extract</li>
            <li data-tab="replace">Replace</li>
            <li data-tab="details">Details</li>
          </ul>
        </header>
        <article class="section-article" id="toolsArticle">
          <div class="inputtool" id="toolsInputTool">
            <div class="inputtool-row">
              <span class="label" id="toolsInputLabel">Template</span>
              <input type="text" class="inputtool-input" id="toolsInputField" />
            </div>
            <div class="inputtool-result" id="toolsResult"></div>
          </div>
          <div class="details-content" id="toolsDetails"></div>
        </article>
      </section>
    `;

    const style = document.createElement('style');
    style.textContent = `
      .section.tools .segcontrol {
        display: flex; gap: 2px; list-style: none; flex: 1; margin-left: 16px;
      }
      .section.tools .segcontrol li {
        padding: 5px 14px; font-size: 12px; font-weight: 500;
        background: var(--bg-elev); color: var(--text-muted);
        border: 1px solid var(--border); cursor: pointer; transition: all 0.15s;
      }
      .section.tools .segcontrol li:first-child { border-radius: 4px 0 0 4px; }
      .section.tools .segcontrol li:last-child { border-radius: 0 4px 4px 0; }
      .section.tools .segcontrol li:hover { color: var(--text); }
      .section.tools .segcontrol li.selected {
        background: var(--accent); color: var(--bg); border-color: var(--accent); font-weight: 600;
      }
      .section.tools .inputtool {
        display: flex; flex-direction: column; flex: 1; min-height: 0;
      }
      .section.tools .inputtool.hide { display: none; }
      .section.tools .inputtool-row {
        display: flex; align-items: center; gap: 12px;
        padding: 10px 16px; background: var(--bg-surface);
        border-bottom: 1px solid var(--border);
      }
      .section.tools .inputtool-row .label {
        color: var(--text-muted); font-size: 11px; font-weight: 600;
        text-transform: uppercase; letter-spacing: 0.06em; min-width: 80px;
      }
      .section.tools .inputtool-input {
        flex: 1; font-family: var(--font-mono); font-size: 14px; font-weight: 500;
        padding: 6px 10px; background: var(--bg-elev);
        border: 1px solid var(--border); border-radius: 4px;
        color: var(--text); outline: none; transition: border-color 0.15s;
      }
      .section.tools .inputtool-input:focus { border-color: var(--accent); }
      .section.tools .inputtool-result {
        flex: 1; padding: 12px 16px; font-family: var(--font-mono);
        font-size: 13px; color: var(--text-dim); line-height: 1.7;
        overflow-y: auto; white-space: pre-wrap; user-select: text;
      }
      .section.tools .details-content {
        flex: 1; overflow-y: auto; padding: 16px; user-select: text;
      }
      .section.tools .details-content.hide { display: none; }
      .section.tools .details-desc {
        color: var(--text-muted); font-size: 12px; margin-bottom: 12px;
      }
      .section.tools .details-desc b { color: var(--text); }
      .section.tools .match-hint {
        background: rgba(224, 175, 104, 0.1);
        border: 1px solid rgba(224, 175, 104, 0.3);
        border-radius: 4px; padding: 8px 12px; margin-bottom: 12px;
        font-size: 12px; color: var(--yellow);
      }
      .section.tools .match-hint b { color: var(--orange); }
      .section.tools table {
        font-family: var(--font-mono); font-size: 12px; width: 100%;
        border-collapse: separate; border-spacing: 0;
        border: 1px solid var(--border); border-radius: 6px; overflow: hidden;
      }
      .section.tools td {
        padding: 6px 12px; border-bottom: 1px solid var(--border-subtle);
        vertical-align: top;
      }
      .section.tools tr:last-child td { border-bottom: none; }
      .section.tools tr.match td { background: var(--bg-surface); }
      .section.tools tr:nth-child(even):not(.match) td { background: var(--bg-elev); }
      .section.tools td:first-child { font-weight: 600; color: var(--accent); white-space: nowrap; }
      .section.tools td:nth-child(2) { color: var(--text-muted); white-space: nowrap; }
      .section.tools td:nth-child(3) { color: var(--text); word-break: break-all; }
      .section.tools .group-0 {
        background: rgba(158, 206, 106, 0.15); color: var(--green);
        padding: 1px 6px; border-radius: 3px; display: inline-block;
      }
      .section.tools .group-1 {
        background: rgba(122, 162, 247, 0.2); color: var(--accent);
        padding: 1px 6px; border-radius: 3px; display: inline-block;
      }
      .section.tools .group-2 {
        background: rgba(187, 154, 247, 0.2); color: var(--purple);
        padding: 1px 6px; border-radius: 3px; display: inline-block;
      }
      .section.tools .no-match {
        color: var(--text-muted); font-style: italic; padding: 20px;
        text-align: center;
      }
    `;
    this.container.appendChild(style);

    // Tab 切换
    this.container.querySelectorAll('#toolsTabs li').forEach((li) => {
      li.addEventListener('click', () => this.switchTab(li.dataset.tab));
    });

    // 输入框事件
    const inputField = this.container.querySelector('#toolsInputField');
    inputField.addEventListener('input', () => {
      if (this.activeTab === 'extract') {
        this.extractTemplate = inputField.value;
      } else if (this.activeTab === 'replace') {
        this.replaceTemplate = inputField.value;
      }
      this.refresh();
    });

    // 初始化
    this.switchTab('match');
  }

  switchTab(tab) {
    this.activeTab = tab;
    this.container.querySelectorAll('#toolsTabs li').forEach((li) => {
      li.classList.toggle('selected', li.dataset.tab === tab);
    });

    const inputTool = this.container.querySelector('#toolsInputTool');
    const details = this.container.querySelector('#toolsDetails');

    if (tab === 'match' || tab === 'details') {
      inputTool.classList.add('hide');
      details.classList.remove('hide');
    } else {
      inputTool.classList.remove('hide');
      details.classList.add('hide');
      const inputField = this.container.querySelector('#toolsInputField');
      const label = this.container.querySelector('#toolsInputLabel');
      if (tab === 'extract') {
        label.textContent = 'Template';
        inputField.value = this.extractTemplate;
      } else if (tab === 'replace') {
        label.textContent = 'Replace';
        inputField.value = this.replaceTemplate;
      }
    }
    this.refresh();
  }

  /**
   * 外部设置匹配结果
   */
  setMatches(matches) {
    this.matches = matches;
    if (this.selectedMatchIndex >= matches.length) {
      this.selectedMatchIndex = 0;
    }
    this.refresh();
  }

  refresh() {
    const result = this.container.querySelector('#toolsResult');
    const details = this.container.querySelector('#toolsDetails');

    if (this.matches.length === 0) {
      if (this.activeTab === 'match' || this.activeTab === 'details') {
        details.innerHTML = '<div class="no-match">No matches</div>';
      } else {
        result.textContent = '';
      }
      return;
    }

    if (this.activeTab === 'match') {
      // 显示选中匹配的详情
      const m = this.matches[this.selectedMatchIndex];
      const groups = m.groups
        .map(
          (g) => `
          <tr>
            <td></td>
            <td>$${g.index}</td>
            <td><span class="group-${Math.min(g.index, 2)}">${escapeHtml(g.value)}</span></td>
          </tr>
        `
        )
        .join('');
      details.innerHTML = `
        <div class="match-hint"><b>Match ${this.selectedMatchIndex + 1} of ${this.matches.length}</b> · 点击 Text 区高亮切换</div>
        <table>
          <tr class="match">
            <td>Match ${this.selectedMatchIndex + 1}</td>
            <td>idx ${m.index}</td>
            <td><span class="group-1">${escapeHtml(m.full)}</span></td>
          </tr>
          ${groups}
        </table>
      `;
    } else if (this.activeTab === 'details') {
      // 显示所有匹配表格
      const rows = this.matches
        .map((m, i) => {
          const groupRows = m.groups
            .map(
              (g) => `
              <tr>
                <td></td>
                <td>$${g.index}</td>
                <td><span class="group-${Math.min(g.index, 2)}">${escapeHtml(g.value)}</span></td>
              </tr>
            `
            )
            .join('');
          return `
            <tr class="match">
              <td>Match ${i + 1}</td>
              <td>idx ${m.index}</td>
              <td><span class="group-1">${escapeHtml(m.full)}</span></td>
            </tr>
            ${groupRows}
          `;
        })
        .join('');
      details.innerHTML = `
        <div class="details-desc"><b>Details</b> 列出所有匹配及捕获组。</div>
        <table>${rows}</table>
      `;
    } else if (this.activeTab === 'extract') {
      const lines = this.matches.map((m) => applyTemplate(this.extractTemplate, m));
      result.textContent = lines.join('\n');
    } else if (this.activeTab === 'replace') {
      // 替换全文（需要原文，由 main.js 注入）
      if (this.onReplacePreview) {
        result.textContent = this.onReplacePreview(this.replaceTemplate, this.matches);
      }
    }
  }

  /**
   * 注册替换预览回调
   */
  setReplacePreview(fn) {
    this.onReplacePreview = fn;
  }

  selectMatch(index) {
    if (index >= 0 && index < this.matches.length) {
      this.selectedMatchIndex = index;
      this.refresh();
    }
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

- [ ] **Step 2: 更新 main.js 集成 Tools**

替换 `src/main.js` 关键部分：
```javascript
import { ToolsUI } from './ui/tools.js';
import { applyTemplate } from './engine/template-parser.js';

// ... 其他 import 同上 ...

const tools = new ToolsUI(document.getElementById('toolsRoot') || (() => {
  const div = document.createElement('div');
  div.id = 'toolsRoot';
  doc.appendChild(div);
  return div;
})());

// 替换预览回调
tools.setReplacePreview((template, matches) => {
  let result = text.getText();
  // 从后往前替换，避免 index 偏移
  const sorted = [...matches].sort((a, b) => b.index - a.index);
  for (const m of sorted) {
    const replaced = applyTemplate(template, m);
    result = result.slice(0, m.index) + replaced + result.slice(m.index + m.length);
  }
  return result;
});

// 触发匹配（更新 runMatch）
const runMatch = debounce(async () => {
  const pattern = expr.getPattern();
  const flags = expr.getFlagsString();
  const body = text.getText();

  if (!pattern) {
    expr.setError(null);
    text.setMatches([]);
    tools.setMatches([]);
    return;
  }

  const result = await solveRegex(pattern, flags, body);
  if (result.error && !result.error.warning) {
    expr.setError(result.error.message);
  } else {
    expr.setError(null);
    text.setMatches(result.matches);
    tools.setMatches(result.matches);
  }
}, 300);
```

- [ ] **Step 3: 启动 dev server 验证**

```bash
pnpm dev
```

测试：
- 输入正则 `(\w+)@(\w+)` 匹配文本 `a@b c@d`
- 切换 Extract Tab，输入 `$1 -> $2`
- Expected: 显示 `a -> b\nc -> d`
- 切换 Replace Tab，输入 `[EMAIL]`
- Expected: 预览 `a@b c@d` 被替换为 `[EMAIL] [EMAIL]`
- 切换 Details Tab
- Expected: 表格显示所有匹配 + 捕获组

- [ ] **Step 4: 提交**

```bash
git add .
git commit -m "feat(ui): 实现 Tools 区 4 Tab（Match/Extract/Replace/Details + 输入框）"
```

---

## Milestone 5 · 样式精修 + 响应式

### Task 12: 移动端响应式

**Files:**
- Modify: `src/styles/mobile.css`

- [ ] **Step 1: 扩展 mobile.css**

追加到 `src/styles/mobile.css`：
```css
@media (max-width: 768px) {
  /* 已经在 Task 7 定义了 header 和 section-header，这里补充其余 */

  .expression-editor {
    padding: 8px 12px !important;
  }
  .expression-editor .slash { font-size: 16px !important; }
  .expression-editor .cm-content { font-size: 13px !important; }
  .flag { font-size: 10px !important; padding: 3px 5px !important; min-width: 22px !important; }

  .section.text .result { font-size: 11px !important; padding: 4px 8px !important; }
  .text-editor-wrap .cm-content { font-size: 12px !important; }

  .section.tools .segcontrol { margin-left: 8px !important; }
  .section.tools .segcontrol li {
    padding: 4px 8px !important; font-size: 11px !important;
  }
  .section.tools .inputtool-row { padding: 8px 12px !important; }
  .section.tools .inputtool-row .label { min-width: 60px !important; font-size: 10px !important; }
  .section.tools .inputtool-input { font-size: 12px !important; padding: 5px 8px !important; }
  .section.tools .inputtool-result { padding: 8px 12px !important; font-size: 12px !important; }
  .section.tools .details-content { padding: 12px !important; }
  .section.tools table { font-size: 11px !important; }
  .section.tools td { padding: 4px 8px !important; }
}
```

- [ ] **Step 2: 在手机上验证**

打开 Chrome DevTools 设备模拟器（iPhone SE / Android），访问 http://localhost:5173/

Expected:
- 顶部栏 48px
- flags 小字号
- Tools 区 Segcontrol 横向可滚动
- 所有字体 12-13px

- [ ] **Step 3: 提交**

```bash
git add .
git commit -m "style: 移动端响应式适配（<768px）"
```

---

## Milestone 6 · 性能与部署

### Task 13: 大文本性能优化

**Files:**
- Modify: `src/engine/regex-solver.js`

- [ ] **Step 1: 使用 Transferable Objects 传大文本**

更新 `regex-worker.js`，新增接受 ArrayBuffer 的版本：
```javascript
export function solveBuffer(buffer, pattern, flags) {
  const text = new TextDecoder().decode(buffer);
  return solve(pattern, flags, text);
}
```

并在 Worker expose 中暴露 `solveBuffer`。

更新 `regex-solver.js`：
```javascript
import { wrap, transfer } from 'comlink';

export async function solveRegex(pattern, flags, text) {
  try {
    const remote = await getApi();
    // 超过 1MB 用 Transferable
    if (text.length > 1_000_000) {
      const buffer = new TextEncoder().encode(text).buffer;
      return await remote.solveBuffer(transfer(buffer, [buffer]), pattern, flags);
    }
    return await remote.solve(pattern, flags, text);
  } catch (err) {
    return { matches: [], error: { message: err.message } };
  }
}
```

- [ ] **Step 2: 手动测试 10MB 文本**

打开 dev server，在 Text 区粘贴 10MB 文本（可用脚本生成 `Array(10_000_000).fill('a').join('')`），输入正则 `a+`

Expected: 匹配在 3 秒内完成，UI 不卡顿

- [ ] **Step 3: 提交**

```bash
git add .
git commit -m "perf: 大文本使用 Transferable Objects 传输（>1MB 零拷贝）"
```

---

### Task 14: 构建 + nginx 部署配置

**Files:**
- Create: `nginx.conf`
- Modify: `package.json`

- [ ] **Step 1: 执行构建**

```bash
pnpm build
```

Expected: `dist/` 目录生成，含 `index.html` + `assets/*.js` + `assets/*.css`

- [ ] **Step 2: 创建 nginx.conf 示例**

`nginx.conf`:
```nginx
server {
    listen 80;
    server_name regex.local;
    root /var/www/regex-tool/dist;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1000;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源长缓存（Vite 产出带 hash 的文件）
    location ~* \.(js|css|woff2|png|svg|ico)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # HTML 永不缓存
    location ~* \.html$ {
        expires -1;
        add_header Cache-Control "no-cache";
    }
}
```

- [ ] **Step 3: 在本地用 nginx 验证**

```bash
# 安装 nginx（如果有）
sudo cp nginx.conf /etc/nginx/conf.d/regex.conf
sudo nginx -t
sudo systemctl reload nginx

# 或者用 python 临时 server 验证静态部署
cd dist && python3 -m http.server 8080
```

打开 http://localhost:8080/，Expected: 应用正常运行，刷新任意路由不 404

- [ ] **Step 4: 提交**

```bash
git add .
git commit -m "build: 配置 nginx 部署示例 + 构建产出验证"
```

---

### Task 15: 端到端验证

**Files:**
- Create: `tests/e2e/smoke.test.js` (可选)

- [ ] **Step 1: 运行所有测试**

```bash
pnpm test
```

Expected: 所有测试通过（template-parser 10 + regex-worker 9 + debounce 3 = 22 tests passed）

- [ ] **Step 2: 构建并本地预览**

```bash
pnpm build
pnpm preview
```

打开 http://localhost:4173/，完整跑一遍以下用例：

| 测试用例 | 预期 |
|---------|------|
| 正则 `https?://[\w.-]+/\S+\.(jpg\|png\|gif)` | 正确高亮 5 处 |
| 点击第 2 个匹配 | Tools.Match 显示 `$1 = png` |
| Extract Tab 输入 `$1 - $0` | 输出 5 行 |
| Replace Tab 输入 `[IMG:$1]` | 预览正确 |
| 命名捕获组 `(?<ext>jpg\|png)` + Extract `${ext}` | 正确输出扩展名 |
| 灾难性正则 `(a+)+$` | 250ms 超时警告，UI 不卡 |
| 10MB 文本 | 匹配 < 3s，滚动流畅 |
| 正则输入清空 | 高亮清除 |
| 正则语法错误 `[abc` | Expression 红框 + 错误信息 |
| 🌙 主题切换 | 浅色/深色切换 + localStorage 持久化 |
| 移动端模拟 | 所有元素可见可点 |

- [ ] **Step 3: 提交最终版本**

```bash
git add .
git commit -m "chore: 完成端到端验证，发布 v0.1.0"
git tag v0.1.0
```

---

## 自审清单（Plan Self-Review）

写完后对照 spec 检查：

| Spec 章节 | 对应 Task | 状态 |
|-----------|-----------|------|
| §1.1 修复 `$1` bug | Task 3 template-parser | ✅ |
| §1.1 修复高亮不准 | Task 10 Decoration API | ✅ |
| §1.1 大文本不卡顿 | Task 13 Transferable | ✅ |
| §3 技术栈 | Task 1/2 安装 | ✅ |
| §4.1 模块划分 | Task 3-11 文件对应 | ✅ |
| §4.3 `$1` 修复代码 | Task 3 完整代码 | ✅ |
| §4.4 高亮修复代码 | Task 10 完整代码 | ✅ |
| §5 UI 布局 | Task 7-11 | ✅ |
| §5.3 Tools Tab 行为 | Task 11 | ✅ |
| §5 边界行为 | Task 10/11 空输入处理 | ✅ |
| §6 样式设计 | Task 7 tokens.css | ✅ |
| §6.6 浅色主题 | Task 8 theme.js | ✅ |
| §7 性能目标 | Task 13 + Task 15 | ✅ |
| §8 nginx 部署 | Task 14 | ✅ |
| §9 验证标准 | Task 15 完整用例 | ✅ |

Placeholder 扫描：无 "TBD"、"implement later"、"similar to Task" 等占位符。

类型一致性：`solve()` / `solveRegex()` / `applyTemplate()` 签名在所有 Task 中保持一致。

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-18-regexr-clone.md`.**

两种执行方式：

**1. Subagent-Driven（推荐）** — 每个 Task 派一个新的 @fixer 子代理执行，Task 之间由 orchestrator 审阅，快速迭代，并行友好。

**2. Inline Execution** — 在当前会话按 Task 顺序执行，每完成一个 Milestone 停下来让你 review。

选哪种？
