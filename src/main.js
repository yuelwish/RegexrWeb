import { initTheme } from './utils/theme.js';
import { renderHeader } from './ui/header.js';
import { ExpressionUI } from './ui/expression.js';
import { TextUI } from './ui/text.js';
import { solveRegex } from './engine/regex-solver.js';
import { debounce } from './utils/debounce.js';
import { ToolsUI } from './ui/tools.js';
import { applyTemplate } from './engine/template-parser.js';

initTheme();
renderHeader(document.getElementById('appHeader'));

const doc = document.getElementById('appDoc');
doc.innerHTML =
  '<div id="expressionRoot"></div>' +
  '<div id="textRoot"></div>' +
  '<div class="resize-handle" id="resizeHandle"></div>' +
  '<div id="toolsRoot"></div>';

const expr = new ExpressionUI(document.getElementById('expressionRoot'));
const text = new TextUI(document.getElementById('textRoot'));
const tools = new ToolsUI(document.getElementById('toolsRoot'));

// 移除 text.js 内创建的多余 resize-handle（已在 doc 层级创建）
const innerHandle = document.getElementById('textRoot').querySelector('.resize-handle');
if (innerHandle) innerHandle.remove();

// 拖拽调整 text/tools 高度比例
const resizeHandle = document.getElementById('resizeHandle');
let isDragging = false;
let startY = 0;
let startTextHeight = 0;

resizeHandle.addEventListener('mousedown', (e) => {
  isDragging = true;
  startY = e.clientY;
  const textRoot = document.getElementById('textRoot');
  startTextHeight = textRoot.offsetHeight;
  resizeHandle.classList.add('dragging');
  document.body.style.cursor = 'row-resize';
  document.body.style.userSelect = 'none';
  e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const textRoot = document.getElementById('textRoot');
  const docRect = doc.getBoundingClientRect();
  const exprHeight = document.getElementById('expressionRoot').offsetHeight;
  const handleHeight = 5;
  const available = docRect.height - exprHeight - handleHeight;
  const delta = e.clientY - startY;
  const newHeight = Math.max(60, Math.min(available - 60, startTextHeight + delta));
  textRoot.style.flex = `0 0 ${newHeight}px`;
});

document.addEventListener('mouseup', () => {
  if (!isDragging) return;
  isDragging = false;
  resizeHandle.classList.remove('dragging');
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
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
    tools.setMatches(result.matches, body);
  }
}, 300);

expr.onChange(runMatch);
text.onChange(runMatch);

// 初始匹配（默认正则）
setTimeout(async () => {
  const pattern = expr.getPattern();
  const flags = expr.getFlagsString();
  const body = text.getText();
  const result = await solveRegex(pattern, flags, body);
  text.setMatches(result.matches);
  tools.setMatches(result.matches, body);
}, 100);

// 替换预览回调
tools.setReplacePreview((template, matches, sourceText) => {
  let result = sourceText || text.getText();
  // 从后往前替换，避免 index 偏移
  const sorted = [...matches].sort((a, b) => b.index - a.index);
  for (const m of sorted) {
    const replaced = applyTemplate(template, { ...m, text: sourceText || text.getText() });
    result = result.slice(0, m.index) + replaced + result.slice(m.index + m.length);
  }
  return result;
});

// 点击 Text 区高亮 → 切换 Match 详情
text.setOnMatchClick((index) => {
  tools.selectMatch(index);
});
