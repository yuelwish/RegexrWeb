import { escapeHtml } from './escape.js';

/**
 * 将文本转为 HTML，空格/Tab 包上可视化圆点/箭头 span。
 * 用于 Expression 高亮层、Tools 模板输入覆盖层等非 CM 场景。
 */
export function htmlWithSpaceDots(text) {
  let out = '';
  const s = String(text ?? '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === ' ') {
      out += '<span class="space-dot"> </span>';
    } else if (ch === '\t') {
      out += '<span class="tab-dot">\t</span>';
    } else {
      out += escapeHtml(ch);
    }
  }
  return out;
}

/**
 * 绑定「透明 input + 覆盖层」的空格圆点预览。
 * @param {HTMLInputElement|HTMLTextAreaElement} input
 * @param {HTMLElement} overlay
 * @param {(value: string) => string} [renderHtml] 默认 htmlWithSpaceDots
 * @returns {() => void} 立即刷新一次的函数
 */
export function bindSpaceDotOverlay(input, overlay, renderHtml = htmlWithSpaceDots) {
  const sync = () => {
    overlay.innerHTML = renderHtml(input.value);
    overlay.scrollLeft = input.scrollLeft;
    if ('scrollTop' in overlay && 'scrollTop' in input) {
      overlay.scrollTop = input.scrollTop;
    }
  };
  input.addEventListener('input', sync);
  input.addEventListener('scroll', () => {
    overlay.scrollLeft = input.scrollLeft;
    if ('scrollTop' in overlay && 'scrollTop' in input) {
      overlay.scrollTop = input.scrollTop;
    }
  });
  sync();
  return sync;
}
