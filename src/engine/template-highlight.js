import { escapeHtml } from '../utils/escape.js';
import { wrapInvisibleChar } from '../utils/space-visual.js';

/**
 * 模板占位符语法高亮 HTML（与 applyTemplate 支持的语法对齐）。
 *
 * 维护：新增/改占位符时必须同步
 *   1) src/engine/template-parser.js（applyTemplate 执行语义）
 *   2) 本文件（显示着色）
 *   3) tests/engine/template-highlight.test.js
 * 否则会出现「显示绿了但执行不认」或反过来。
 *
 * 着色类别：
 *   tpl-ref   — $& $0 $1… $` $'（匹配引用）
 *   tpl-named — ${name}
 *   tpl-esc   — \n \t（字面转义，非正则）
 *   space-dot / tab-dot — 字面空格/Tab
 *   tpl-text  — 其余字面量
 *
 * 不改字符 advance（仅 span 染色 + 空格圆点 paint；禁止 letter-spacing）。
 */
export function htmlWithTemplateHighlight(text) {
  const s = String(text ?? '');
  let out = '';
  let i = 0;
  const n = s.length;

  while (i < n) {
    const ch = s[i];

    // \n / \t 转义（两字符）
    if (ch === '\\' && i + 1 < n) {
      const next = s[i + 1];
      if (next === 'n' || next === 't') {
        out += `<span class="tpl-esc">\\${next}</span>`;
        i += 2;
        continue;
      }
    }

    // ${name}
    if (ch === '$' && s[i + 1] === '{') {
      let j = i + 2;
      while (j < n && /[\w]/.test(s[j])) j++;
      if (j < n && s[j] === '}' && j > i + 2) {
        out += `<span class="tpl-named">${escapeHtml(s.slice(i, j + 1))}</span>`;
        i = j + 1;
        continue;
      }
    }

    // $&  $`  $'  $digits
    if (ch === '$') {
      const next = s[i + 1];
      if (next === '&' || next === '`' || next === "'") {
        out += `<span class="tpl-ref">${escapeHtml(s.slice(i, i + 2))}</span>`;
        i += 2;
        continue;
      }
      if (next >= '0' && next <= '9') {
        let j = i + 1;
        while (j < n && s[j] >= '0' && s[j] <= '9') j++;
        out += `<span class="tpl-ref">${escapeHtml(s.slice(i, j))}</span>`;
        i = j;
        continue;
      }
      // 单独的 $
      out += `<span class="tpl-text">$</span>`;
      i++;
      continue;
    }

    // 字面空格 / Tab
    const inv = wrapInvisibleChar(ch);
    if (inv) {
      out += inv;
      i++;
      continue;
    }

    // 连续字面量（减少 DOM 节点）
    let j = i + 1;
    while (j < n) {
      const c = s[j];
      if (c === '$' || c === '\\' || c === ' ' || c === '\t') break;
      j++;
    }
    out += `<span class="tpl-text">${escapeHtml(s.slice(i, j))}</span>`;
    i = j;
  }

  return out;
}
