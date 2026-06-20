import { applyTemplate } from '../engine/template-parser.js';
import { escapeHtml } from '../utils/escape.js';

export class ToolsUI {
  constructor(container) {
    this.container = container;
    this.activeTab = 'match';
    this.matches = [];
    this.selectedMatchIndex = 0;
    this.extractTemplate = '$&';
    this.replaceTemplate = '<< $& >>';
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
          <button class="minimize-btn" id="toolsMinimize" title="最小化/展开">
            <svg class="icon" viewBox="0 0 24 24"><path d="M7 14l5-5 5 5z" fill="currentColor"/></svg>
          </button>
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

    // 最小化按钮
    this.minimizeBtn = this.container.querySelector('#toolsMinimize');
    this.minimizeBtn.addEventListener('click', () => this.toggleMinimize());

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

    // Ctrl+A 全选结果区域
    const resultEl = this.container.querySelector('#toolsResult');
    const detailsEl = this.container.querySelector('#toolsDetails');
    [resultEl, detailsEl].forEach((el) => {
      if (!el) return;
      el.setAttribute('tabindex', '0');
      el.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
          e.preventDefault();
          const range = document.createRange();
          range.selectNodeContents(el);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
      });
    });

    // 初始化
    this.switchTab('match');
  }

  switchTab(tab) {
    this.activeTab = tab;
    this.container.querySelectorAll('#toolsTabs li').forEach((li) => {
      li.classList.toggle('selected', li.dataset.tab === tab);
    });

    // 切换 tab 时自动展开（如果已最小化）
    if (this.container.querySelector('.section.tools').classList.contains('minimized')) {
      this.toggleMinimize();
    }

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
   * 最小化/展开切换
   */
  toggleMinimize() {
    const section = this.container.querySelector('.section.tools');
    section.classList.toggle('minimized');
    const isMinimized = section.classList.contains('minimized');

    // 最小化时，内容区域放大，结果区域缩小
    const textRoot = document.getElementById('textRoot');
    const toolsRoot = document.getElementById('toolsRoot');
    if (textRoot) {
      textRoot.style.flex = isMinimized ? '1 1 0%' : '0 0 50%';
    }
    if (toolsRoot) {
      toolsRoot.style.flex = isMinimized ? '0 0 38px' : '1 1 0%';
    }

    // 切换箭头方向
    if (this.minimizeBtn) {
      this.minimizeBtn.querySelector('svg').style.transform = isMinimized ? 'rotate(180deg)' : '';
    }
  }

  /**
   * 外部设置匹配结果
   */
  setMatches(matches, sourceText) {
    this.matches = matches;
    this._sourceText = sourceText || '';
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
      const lines = this.matches.map((m) => applyTemplate(this.extractTemplate, { ...m, text: this._sourceText }));
      result.textContent = lines.join('\n');
    } else if (this.activeTab === 'replace') {
      // 替换全文（需要原文，由 main.js 注入）
      if (this.onReplacePreview) {
        result.textContent = this.onReplacePreview(this.replaceTemplate, this.matches, this._sourceText);
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


