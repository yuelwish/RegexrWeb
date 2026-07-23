import { escapeHtml } from './escape.js';

/**
 * 空格/Tab → 可视化 span；其它字符返回 null。
 * @param {string} ch 单字符
 * @param {string} [extraClass] 附加 class（如 Expression 的 tk-char）
 * @returns {string|null}
 */
export function wrapInvisibleChar(ch, extraClass = '') {
  if (ch === ' ') {
    const cls = ['space-dot', extraClass].filter(Boolean).join(' ');
    return `<span class="${cls}"> </span>`;
  }
  if (ch === '\t') {
    const cls = ['tab-dot', extraClass].filter(Boolean).join(' ');
    return `<span class="${cls}">\t</span>`;
  }
  return null;
}

/**
 * 将文本转为 HTML，空格/Tab 包上可视化圆点/箭头 span。
 * 用于 Tools 模板覆盖层等非 CM、无语法着色场景。
 */
export function htmlWithSpaceDots(text) {
  let out = '';
  const s = String(text ?? '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    out += wrapInvisibleChar(ch) ?? escapeHtml(ch);
  }
  return out;
}

/**
 * 绑定「透明 input + 覆盖层」的空格圆点预览。
 * 契约：覆盖层与 input 同 font/padding，禁止对 .space-dot 改 letter-spacing/advance。
 *
 * @param {HTMLInputElement|HTMLTextAreaElement} input
 * @param {HTMLElement} overlay
 * @param {{ renderHtml?: (value: string) => string, onInput?: (value: string) => void }} [options]
 * @returns {{ sync: () => void, destroy: () => void }}
 */
export function bindSpaceDotOverlay(input, overlay, options = {}) {
  const { renderHtml = htmlWithSpaceDots, onInput } = options;

  const sync = () => {
    overlay.innerHTML = renderHtml(input.value);
    overlay.scrollLeft = input.scrollLeft;
    if ('scrollTop' in overlay && 'scrollTop' in input) {
      overlay.scrollTop = input.scrollTop;
    }
  };

  const onInputEvt = () => {
    sync();
    onInput?.(input.value);
  };

  const onScrollEvt = () => {
    overlay.scrollLeft = input.scrollLeft;
    if ('scrollTop' in overlay && 'scrollTop' in input) {
      overlay.scrollTop = input.scrollTop;
    }
  };

  input.addEventListener('input', onInputEvt);
  input.addEventListener('scroll', onScrollEvt);
  sync();

  return {
    sync,
    destroy() {
      input.removeEventListener('input', onInputEvt);
      input.removeEventListener('scroll', onScrollEvt);
    },
  };
}
