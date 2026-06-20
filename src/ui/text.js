import { EditorView, basicSetup } from 'codemirror';
import { EditorState, StateField, StateEffect } from '@codemirror/state';
import { Decoration } from '@codemirror/view';

const SAMPLE_TEXT = `RegExr was created by gskinner.com.

Edit the Expression & Text to see matches. Roll over matches or the expression for details. PCRE & JavaScript flavors of RegEx are supported. Validate your expression with Tests mode.

The side bar includes a Cheatsheet, full Reference, and Help. You can also Save & Share with the Community and view patterns you create or favorite in My Patterns.

Explore results with the Tools below. Replace & List output custom results. Details lists capture groups. Explain describes your expression in plain English.`;

// StateEffect 用于更新 decorations
const updateDecorations = StateEffect.define();

// StateField 存储当前 decorations
const decorationField = StateField.define({
  create() {
    return Decoration.none;
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(updateDecorations)) {
        return effect.value;
      }
    }
    return value;
  },
});

export class TextUI {
  constructor(container) {
    this.container = container;
    this.matchCount = 0;
    this.listeners = new Set();
    this.matches = [];
    this.onMatchClick = null;
    this.selectedMatchIndex = -1;
    this.render();
    this.mountEditor();
  }

  render() {
    this.container.innerHTML = `
      <section class="section text">
        <header class="section-header">
          <h1>Text</h1>
          <div class="result" id="matchResult"><span class="dot"></span>No match</div>
          <ul class="modelist">
            <li class="selected">Text</li>
          </ul>
        </header>
        <article class="section-article">
          <div class="text-editor-wrap" id="textEditorMount"></div>
        </article>
      </section>
    `;
  }

  mountEditor() {
    const self = this;

    this.view = new EditorView({
      state: EditorState.create({
        doc: SAMPLE_TEXT,
        extensions: [
          basicSetup,
          decorationField,
          EditorView.decorations.of((state) => {
            return state.field(decorationField);
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              this.emit();
            }
          }),
          EditorView.domEventHandlers({
            click: (event, view) => {
              const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
              if (pos === null) return false;

              for (let i = 0; i < self.matches.length; i++) {
                const m = self.matches[i];
                if (pos >= m.index && pos < m.index + m.length) {
                  self.selectMatch(i);
                  return false;
                }
              }
              return false;
            },
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

  setOnMatchClick(fn) {
    this.onMatchClick = fn;
  }

  /**
   * 选择指定匹配（高亮 + 回调）
   */
  selectMatch(index) {
    if (index < 0 || index >= this.matches.length) return;
    this.selectedMatchIndex = index;
    this.updateDecorations();
    if (this.onMatchClick) this.onMatchClick(index);
  }

  /**
   * 更新匹配高亮（不重建编辑器）
   */
  setMatches(matches) {
    this.matches = matches;
    this.matchCount = matches.length;
    this.selectedMatchIndex = -1;
    this.updateDecorations();
    this.updateResult();
  }

  /**
   * 使用 StateEffect 更新 decorations（不重建编辑器）
   */
  updateDecorations() {
    if (!this.view) return;

    const decos = this.matches.map((m, i) => {
      const classes = i === this.selectedMatchIndex ? 'cm-match cm-match-selected' : 'cm-match';
      return Decoration.mark({
        class: classes,
        attributes: { 'data-idx': String(m.index) },
      }).range(m.index, m.index + m.length);
    });

    const decorationSet = Decoration.set(decos, true);

    this.view.dispatch({
      effects: updateDecorations.of(decorationSet),
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
