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
