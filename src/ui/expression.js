const FLAGS = [
  { key: 'g', label: 'g', title: 'global - 匹配所有结果' },
  { key: 'i', label: 'i', title: 'ignoreCase - 不区分大小写' },
  { key: 'm', label: 'm', title: 'multiline - ^$ 匹配每行' },
  { key: 's', label: 's', title: 'dotAll - . 匹配换行符' },
  { key: 'u', label: 'u', title: 'unicode - Unicode 模式' },
  { key: 'y', label: 'y', title: 'sticky - 粘滞匹配' },
];

// 正则 token 着色规则
const TOKEN_RULES = [
  { regex: /^\\[dDwWsSbB]/, cls: 'tk-meta' },
  { regex: /^\\[.\d]/, cls: 'tk-meta' },
  { regex: /^\[\^?/, cls: 'tk-class' },
  { regex: /^\]/, cls: 'tk-class' },
  { regex: /^[()]/, cls: 'tk-group' },
  { regex: /^[?+*{}]/, cls: 'tk-quant' },
  { regex: /^\|/, cls: 'tk-alt' },
  { regex: /^\^/, cls: 'tk-anchor' },
  { regex: /^\$/, cls: 'tk-anchor' },
  { regex: /^\./, cls: 'tk-dot' },
];

export class ExpressionUI {
  constructor(container) {
    this.container = container;
    this.pattern = '([A-Z])\\w+';
    this.flags = new Set(['g']);
    this.listeners = new Set();
    this.render();
    // 设置初始值并触发匹配
    const input = this.container.querySelector('#expressionInput');
    if (input) input.value = this.pattern;
    this.renderHighlight();
    // 延迟触发，确保 listeners 已绑定
    setTimeout(() => this.emit(), 0);
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
        <div class="expression-bar">
          <span class="slash">/</span>
          <div class="expression-input-wrap">
            <input
              class="expression-input"
              id="expressionInput"
              type="text"
              placeholder="输入正则表达式..."
              spellcheck="false"
              autocomplete="off"
            />
            <div class="expression-hl" id="expressionHl"></div>
          </div>
          <span class="slash">/</span>
        </div>
        <div class="expression-error" id="expressionError"></div>
      </section>
    `;

    // 样式
    const style = document.createElement('style');
    style.textContent = `
      .section.expression .section-header h1 { color: var(--accent); }
      .section.expression .section-header {
        background: var(--bg-surface);
      }

      /* Flags */
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

      /* Expression bar */
      .expression-bar {
        display: flex; align-items: center; gap: 4px;
        padding: 10px 16px; background: var(--bg);
        border-bottom: 1px solid var(--border); min-height: 44px;
      }
      .expression-bar .slash {
        color: var(--accent); font-family: var(--font-mono);
        font-size: 18px; font-weight: 700; flex-shrink: 0;
      }
      .expression-input-wrap {
        flex: 1; min-width: 0; position: relative;
      }
      .expression-input {
        width: 100%; font-family: var(--font-mono); font-size: 16px; font-weight: 400;
        background: transparent; color: transparent; border: none;
        outline: none; padding: 4px 4px;
        caret-color: var(--text);
      }
      .expression-input::placeholder { color: var(--text-faint); }

      /* Syntax highlight overlay */
      .expression-hl {
        position: absolute;
        left: 0;
        right: 0;
        top: 4px;
        bottom: 4px;
        font-family: var(--font-mono); font-size: 16px; font-weight: 400;
        pointer-events: none;
        padding: 2px 4px; white-space: pre; overflow: hidden;
        display: flex;
        align-items: center;
      }

      /* Token colors */
      .tk-meta { color: var(--orange); font-weight: 600; }
      .tk-class { color: var(--yellow); font-weight: 600; }
      .tk-group { color: var(--green); font-weight: 600; }
      .tk-quant { color: var(--cyan); font-weight: 600; }
      .tk-alt { color: var(--purple); font-weight: 600; }
      .tk-anchor { color: var(--purple); font-weight: 600; }
      .tk-dot { color: var(--text); }
      .tk-esc { color: var(--purple); font-weight: 600; }
      .tk-char { color: var(--text); }

      /* Error */
      .expression-bar.error { outline: 2px solid var(--red); outline-offset: -2px; }
      .expression-error {
        color: var(--red); font-size: 12px; padding: 4px 16px 8px;
        background: var(--bg); border-bottom: 1px solid var(--border);
        display: none;
      }
      .expression-error.show { display: block; }
    `;
    this.container.appendChild(style);

    // 输入事件
    const input = this.container.querySelector('#expressionInput');
    const hl = this.container.querySelector('#expressionHl');

    input.addEventListener('input', () => {
      this.pattern = input.value;
      this.renderHighlight();
      this.emit();
    });

    input.addEventListener('keydown', (e) => {
      // 让箭头键和退格正常工作
      if (e.key === 'Enter') e.preventDefault();
    });

    // Flag 切换
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
   * 简单正则语法高亮
   */
  renderHighlight() {
    const hl = this.container.querySelector('#expressionHl');
    if (!hl) return;

    const pattern = this.pattern;
    if (!pattern) {
      hl.innerHTML = '';
      return;
    }

    let html = '';
    let i = 0;
    const n = pattern.length;

    while (i < n) {
      const ch = pattern[i];
      let matched = false;

      // 转义序列
      if (ch === '\\' && i + 1 < n) {
        const esc = pattern.substring(i, i + 2);
        html += `<span class="tk-esc">${escapeHtml(esc)}</span>`;
        i += 2;
        matched = true;
      }

      // 字符集 [...]
      if (!matched && ch === '[') {
        let j = i + 1;
        if (pattern[j] === '^') j++;
        if (pattern[j] === ']') j++;
        while (j < n && pattern[j] !== ']') {
          if (pattern[j] === '\\' && j + 1 < n) j++; // 跳过转义
          j++;
        }
        const cls = pattern[i + 1] === '^' ? 'tk-class tk-negate' : 'tk-class';
        html += `<span class="${cls}">${escapeHtml(pattern.substring(i, j + 1))}</span>`;
        i = j + 1;
        matched = true;
      }

      // 捕获组
      if (!matched && ch === '(') {
        let cls = 'tk-group';
        let j = i + 1;
        if (pattern.substring(i, i + 2) === '(?') {
          if (pattern[i + 2] === ':') cls = 'tk-group tk-nocap';
          else if (pattern[i + 2] === '=') cls = 'tk-group tk-lookahead';
          else if (pattern[i + 2] === '!') cls = 'tk-group tk-neglookahead';
        }
        html += `<span class="${cls}">(</span>`;
        i++;
        matched = true;
      }

      if (!matched && ch === ')') {
        html += `<span class="tk-group">)</span>`;
        i++;
        matched = true;
      }

      // 量词
      if (!matched && /[?+*]/.test(ch)) {
        html += `<span class="tk-quant">${ch}</span>`;
        i++;
        matched = true;
      }

      if (!matched && ch === '{') {
        let j = i;
        while (j < n && pattern[j] !== '}') j++;
        html += `<span class="tk-quant">${escapeHtml(pattern.substring(i, j + 1))}</span>`;
        i = j + 1;
        matched = true;
      }

      // 锚点
      if (!matched && ch === '^') {
        html += `<span class="tk-anchor">^</span>`;
        i++;
        matched = true;
      }

      if (!matched && ch === '$') {
        html += `<span class="tk-anchor">$</span>`;
        i++;
        matched = true;
      }

      // 交替
      if (!matched && ch === '|') {
        html += `<span class="tk-alt">|</span>`;
        i++;
        matched = true;
      }

      // 点
      if (!matched && ch === '.') {
        html += `<span class="tk-dot">.</span>`;
        i++;
        matched = true;
      }

      // 普通字符
      if (!matched) {
        html += `<span class="tk-char">${escapeHtml(ch)}</span>`;
        i++;
      }
    }

    hl.innerHTML = html;
  }

  getFlagsString() {
    return [...this.flags].join('');
  }

  getPattern() {
    return this.pattern;
  }

  setPattern(pattern) {
    this.pattern = pattern;
    const input = this.container.querySelector('#expressionInput');
    if (input) input.value = pattern;
    this.renderHighlight();
  }

  setError(message) {
    const el = this.container.querySelector('#expressionError');
    const bar = this.container.querySelector('.expression-bar');
    if (message) {
      el.textContent = message;
      el.classList.add('show');
      bar.classList.add('error');
    } else {
      el.classList.remove('show');
      bar.classList.remove('error');
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

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
