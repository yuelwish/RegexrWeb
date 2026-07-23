import { EditorView, basicSetup } from 'codemirror';
import { EditorState, StateField, StateEffect } from '@codemirror/state';
import { Decoration, WidgetType } from '@codemirror/view';

// StateEffect 用于更新 decorations
const updateDecorationsEffect = StateEffect.define();

// StateField 存储当前 decorations
const decorationField = StateField.define({
  create() {
    return Decoration.none;
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(updateDecorationsEffect)) {
        return effect.value;
      }
    }
    return value.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

const SAMPLE_TEXT = `RegExr was created by gskinner.com.

Edit the Expression & Text to see matches. Roll over matches or the expression for details. PCRE & JavaScript flavors of RegEx are supported. Validate your expression with Tests mode.

The side bar includes a Cheatsheet, full Reference, and Help. You can also Save & Share with the Community and view patterns you create or favorite in My Patterns.

Explore results with the Tools below. Replace & List output custom results. Details lists capture groups. Explain describes your expression in plain English.`;

// 搜索框高亮装饰（独立于正则匹配的装饰）
const updateSearchDecorationsEffect = StateEffect.define();

const searchDecorationField = StateField.define({
  create() {
    return Decoration.none;
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(updateSearchDecorationsEffect)) {
        return effect.value;
      }
    }
    if (tr.docChanged) {
      return Decoration.none;
    }
    return value.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

/** 不可见字符可视化 widget（空格/制表符/换行/回车） */
class InvisibleCharWidget extends WidgetType {
  constructor(ch) {
    super();
    this.ch = ch;
  }

  eq(other) {
    return other instanceof InvisibleCharWidget && other.ch === this.ch;
  }

  toDOM() {
    const span = document.createElement('span');
    span.className = 'invisible-marker';
    const kind =
      this.ch === ' ' ? 'space' : this.ch === '\t' ? 'tab' : this.ch === '\n' ? 'nl' : 'cr';
    span.setAttribute('data-char', kind);
    // 空格用 CSS 小圆点（半角窄）；其余用半角/窄 Unicode
    if (kind === 'space') {
      span.textContent = '';
    } else if (kind === 'tab') {
      span.textContent = '>'; // 半角 ASCII，避免全角箭头占宽
    } else if (kind === 'nl') {
      span.textContent = '\u21b5'; // ↵
    } else {
      span.textContent = '\u240d'; // ␍
    }
    span.setAttribute('aria-hidden', 'true');
    return span;
  }

  ignoreEvent() {
    return true;
  }
}

function buildInvisibleDecorations(doc) {
  const decos = [];
  const text = doc.toString();

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === ' ') {
      // 行尾空格（紧跟换行）不显示 marker
      const next = text[i + 1];
      if (next === '\n' || next === '\r') continue;
      decos.push(
        Decoration.replace({
          widget: new InvisibleCharWidget(ch),
        }).range(i, i + 1)
      );
      continue;
    }

    if (ch === '\t') {
      decos.push(
        Decoration.replace({
          widget: new InvisibleCharWidget(ch),
        }).range(i, i + 1)
      );
      continue;
    }

    // side: -1 → widget 在换行符之前，显示在当前行尾
    if (ch === '\n' || ch === '\r') {
      decos.push(
        Decoration.widget({
          widget: new InvisibleCharWidget(ch),
          side: -1,
        }).range(i)
      );
    }
  }

  return Decoration.set(decos, true);
}

const invisibleCharsField = StateField.define({
  create(state) {
    return buildInvisibleDecorations(state.doc);
  },
  update(value, tr) {
    if (tr.docChanged) {
      return buildInvisibleDecorations(tr.state.doc);
    }
    return value;
  },
  provide: (f) => EditorView.decorations.from(f),
});

export class TextUI {
  constructor(container) {
    this.container = container;
    this.matchCount = 0;
    this.listeners = new Set();
    this.matches = [];
    this.onMatchClick = null;
    this.selectedMatchIndex = -1;
    this.decorations = Decoration.none;

    // 搜索框状态
    this.searchOpen = false;
    this.searchTerm = '';
    this.searchMatches = [];
    this.selectedSearchIndex = -1;

    this.render();
    this.mountEditor();
    this.initSearchBox();
    this.initKeyboardShortcuts();
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
          <div class="text-editor-wrap" id="textEditorMount">
            <div class="search-box" id="searchBox" role="search" aria-label="Find text">
              <input class="search-input" id="searchInput" type="text" placeholder="Find..." autocomplete="off" spellcheck="false" aria-label="Search term" />
              <div class="search-count" id="searchCount">0/0</div>
              <button class="search-btn" id="searchPrev" type="button" aria-label="Previous match" title="Previous (Shift+Enter)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
              </button>
              <button class="search-btn" id="searchNext" type="button" aria-label="Next match" title="Next (Enter)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <button class="search-btn search-close" id="searchClose" type="button" aria-label="Close search" title="Close (Escape)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
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
          searchDecorationField,
          invisibleCharsField,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              this.emit();
              if (this.searchOpen && this.searchTerm) {
                this.performSearch();
              }
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

  selectMatch(index) {
    if (index < 0 || index >= this.matches.length) return;
    this.selectedMatchIndex = index;
    this.updateDecorations();
    
    // 滚动到匹配位置
    const match = this.matches[index];
    if (this.view && match) {
      this.view.dispatch({
        effects: EditorView.scrollIntoView(match.index, { y: 'center' })
      });
    }
    
    if (this.onMatchClick) this.onMatchClick(index);
  }

  setMatches(matches) {
    this.matches = matches;
    this.matchCount = matches.length;
    this.selectedMatchIndex = -1;
    this.updateDecorations();
    this.updateResult();
  }

  updateDecorations() {
    const decos = this.matches.map((m, i) => {
      const classes = i === this.selectedMatchIndex ? 'cm-match cm-match-selected' : 'cm-match';
      return Decoration.mark({
        class: classes,
        attributes: { 'data-idx': String(m.index) },
      }).range(m.index, m.index + m.length);
    });

    const decorationSet = Decoration.set(decos, true);

    if (this.view) {
      this.view.dispatch({
        effects: updateDecorationsEffect.of(decorationSet),
      });
    }
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

  // ========== 搜索框功能 ==========

  initKeyboardShortcuts() {
    // Use capture phase so we intercept Ctrl+F before CodeMirror or other elements handle it.
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        // Only intercept when the Text section is visible.
        const textSection = this.container.querySelector('.section.text');
        if (textSection && textSection.offsetParent !== null) {
          e.preventDefault();
          e.stopPropagation();
          this.openSearchBox();
        }
      }
    }, true);
  }

  initSearchBox() {
    const searchBox = this.container.querySelector('#searchBox');
    const searchInput = this.container.querySelector('#searchInput');
    const searchPrev = this.container.querySelector('#searchPrev');
    const searchNext = this.container.querySelector('#searchNext');
    const searchClose = this.container.querySelector('#searchClose');

    // 输入搜索
    searchInput.addEventListener('input', () => {
      this.searchTerm = searchInput.value;
      this.performSearch();
    });

    // Enter / Shift+Enter 导航匹配
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          this.navigateSearch(-1);
        } else {
          this.navigateSearch(1);
        }
      }
      if (e.key === 'Escape') {
        this.closeSearchBox();
      }
    });

    // 按钮事件
    searchPrev.addEventListener('click', () => this.navigateSearch(-1));
    searchNext.addEventListener('click', () => this.navigateSearch(1));
    searchClose.addEventListener('click', () => this.closeSearchBox());
  }

  openSearchBox() {
    this.searchOpen = true;
    const searchBox = this.container.querySelector('#searchBox');
    const searchInput = this.container.querySelector('#searchInput');

    // Reset input and previous search state
    searchInput.value = '';
    this.searchTerm = '';
    this.searchMatches = [];
    this.selectedSearchIndex = -1;
    this.clearSearchDecorations();
    this.updateSearchCount();

    searchBox.classList.add('visible');

    // Focus after the transition so the browser accepts focus on a visible element
    setTimeout(() => {
      searchInput.focus();
      searchInput.select();
    }, 160);
  }

  closeSearchBox() {
    this.searchOpen = false;
    const searchBox = this.container.querySelector('#searchBox');
    const searchInput = this.container.querySelector('#searchInput');
    searchBox.classList.remove('visible');
    searchInput.value = '';
    this.searchTerm = '';
    this.searchMatches = [];
    this.selectedSearchIndex = -1;
    this.clearSearchDecorations();
    this.updateSearchCount();
  }

  performSearch() {
    if (!this.searchTerm) {
      this.searchMatches = [];
      this.selectedSearchIndex = -1;
      this.clearSearchDecorations();
      this.updateSearchCount();
      return;
    }

    const text = this.getText();
    const term = this.searchTerm.toLowerCase();
    this.searchMatches = [];

    let idx = text.toLowerCase().indexOf(term);
    while (idx !== -1) {
      this.searchMatches.push({ index: idx, length: this.searchTerm.length });
      idx = text.toLowerCase().indexOf(term, idx + 1);
    }

    this.selectedSearchIndex = this.searchMatches.length > 0 ? 0 : -1;
    this.updateSearchDecorations();
    this.updateSearchCount();

    if (this.searchMatches.length > 0) {
      this.scrollToSearchMatch(0);
    }
  }

  navigateSearch(direction) {
    if (this.searchMatches.length === 0) return;

    this.selectedSearchIndex += direction;
    if (this.selectedSearchIndex < 0) {
      this.selectedSearchIndex = this.searchMatches.length - 1;
    } else if (this.selectedSearchIndex >= this.searchMatches.length) {
      this.selectedSearchIndex = 0;
    }

    this.updateSearchDecorations();
    this.updateSearchCount();
    this.scrollToSearchMatch(this.selectedSearchIndex);
  }

  scrollToSearchMatch(index) {
    const match = this.searchMatches[index];
    if (match && this.view) {
      this.view.dispatch({
        effects: EditorView.scrollIntoView(match.index, { y: 'center' }),
      });
    }
  }

  updateSearchDecorations() {
    const decos = this.searchMatches.map((m, i) => {
      const cls = i === this.selectedSearchIndex ? 'cm-search-match cm-search-match-selected' : 'cm-search-match';
      return Decoration.mark({ class: cls }).range(m.index, m.index + m.length);
    });

    if (this.view) {
      this.view.dispatch({
        effects: updateSearchDecorationsEffect.of(Decoration.set(decos, true)),
      });
    }
  }

  clearSearchDecorations() {
    if (this.view) {
      this.view.dispatch({
        effects: updateSearchDecorationsEffect.of(Decoration.none),
      });
    }
  }

  updateSearchCount() {
    const el = this.container.querySelector('#searchCount');
    if (!el) return;
    if (this.searchMatches.length === 0) {
      el.textContent = this.searchTerm ? '—' : '0/0';
      el.classList.toggle('no-match', this.searchTerm.length > 0);
    } else {
      el.textContent = `${this.selectedSearchIndex + 1}/${this.searchMatches.length}`;
      el.classList.remove('no-match');
    }
  }
}
