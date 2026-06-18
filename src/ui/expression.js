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
   * 挂载 CodeMirror 编辑器（由外部调用）
   */
  mountEditor(cmView) {
    this.cmView = cmView;
    // 初始读取
    this.pattern = cmView.state.doc.toString();
  }

  getFlagsString() {
    return [...this.flags].join('');
  }

  getPattern() {
    return this.pattern;
  }

  setPattern(pattern) {
    this.pattern = pattern;
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
