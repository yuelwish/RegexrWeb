import { applyTemplate } from '../engine/template-parser.js';

export class ToolsUI {
  constructor(container) {
    this.container = container;
    this.activeTab = 'match';
    this.matches = [];
    this.selectedMatchIndex = 0;
    this.extractTemplate = '$1 - $0';
    this.replaceTemplate = '[IMG:$1]';
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

    const style = document.createElement('style');
    style.textContent = `
      .section.tools .segcontrol {
        display: flex; gap: 2px; list-style: none; flex: 1; margin-left: 16px;
      }
      .section.tools .segcontrol li {
        padding: 5px 14px; font-size: 12px; font-weight: 500;
        background: var(--bg-elev); color: var(--text-muted);
        border: 1px solid var(--border); cursor: pointer; transition: all 0.15s;
      }
      .section.tools .segcontrol li:first-child { border-radius: 4px 0 0 4px; }
      .section.tools .segcontrol li:last-child { border-radius: 0 4px 4px 0; }
      .section.tools .segcontrol li:hover { color: var(--text); }
      .section.tools .segcontrol li.selected {
        background: var(--accent); color: var(--bg); border-color: var(--accent); font-weight: 600;
      }
      .section.tools .inputtool {
        display: flex; flex-direction: column; flex: 1; min-height: 0;
      }
      .section.tools .inputtool.hide { display: none; }
      .section.tools .inputtool-row {
        display: flex; align-items: center; gap: 12px;
        padding: 10px 16px; background: var(--bg-surface);
        border-bottom: 1px solid var(--border);
      }
      .section.tools .inputtool-row .label {
        color: var(--text-muted); font-size: 11px; font-weight: 600;
        text-transform: uppercase; letter-spacing: 0.06em; min-width: 80px;
      }
      .section.tools .inputtool-input {
        flex: 1; font-family: var(--font-mono); font-size: 14px; font-weight: 500;
        padding: 6px 10px; background: var(--bg-elev);
        border: 1px solid var(--border); border-radius: 4px;
        color: var(--text); outline: none; transition: border-color 0.15s;
      }
      .section.tools .inputtool-input:focus { border-color: var(--accent); }
      .section.tools .inputtool-result {
        flex: 1; padding: 12px 16px; font-family: var(--font-mono);
        font-size: 13px; color: var(--text-dim); line-height: 1.7;
        overflow-y: auto; white-space: pre-wrap; user-select: text;
      }
      .section.tools .details-content {
        flex: 1; overflow-y: auto; padding: 16px; user-select: text;
      }
      .section.tools .details-content.hide { display: none; }
      .section.tools .details-desc {
        color: var(--text-muted); font-size: 12px; margin-bottom: 12px;
      }
      .section.tools .details-desc b { color: var(--text); }
      .section.tools .match-hint {
        background: rgba(224, 175, 104, 0.1);
        border: 1px solid rgba(224, 175, 104, 0.3);
        border-radius: 4px; padding: 8px 12px; margin-bottom: 12px;
        font-size: 12px; color: var(--yellow);
      }
      .section.tools .match-hint b { color: var(--orange); }
      .section.tools table {
        font-family: var(--font-mono); font-size: 12px; width: 100%;
        border-collapse: separate; border-spacing: 0;
        border: 1px solid var(--border); border-radius: 6px; overflow: hidden;
      }
      .section.tools td {
        padding: 6px 12px; border-bottom: 1px solid var(--border-subtle);
        vertical-align: top;
      }
      .section.tools tr:last-child td { border-bottom: none; }
      .section.tools tr.match td { background: var(--bg-surface); }
      .section.tools tr:nth-child(even):not(.match) td { background: var(--bg-elev); }
      .section.tools td:first-child { font-weight: 600; color: var(--accent); white-space: nowrap; }
      .section.tools td:nth-child(2) { color: var(--text-muted); white-space: nowrap; }
      .section.tools td:nth-child(3) { color: var(--text); word-break: break-all; }
      .section.tools .group-0 {
        background: rgba(158, 206, 106, 0.15); color: var(--green);
        padding: 1px 6px; border-radius: 3px; display: inline-block;
      }
      .section.tools .group-1 {
        background: rgba(122, 162, 247, 0.2); color: var(--accent);
        padding: 1px 6px; border-radius: 3px; display: inline-block;
      }
      .section.tools .group-2 {
        background: rgba(187, 154, 247, 0.2); color: var(--purple);
        padding: 1px 6px; border-radius: 3px; display: inline-block;
      }
      .section.tools .no-match {
        color: var(--text-muted); font-style: italic; padding: 20px;
        text-align: center;
      }
    `;
    this.container.appendChild(style);

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

    // 初始化
    this.switchTab('match');
  }

  switchTab(tab) {
    this.activeTab = tab;
    this.container.querySelectorAll('#toolsTabs li').forEach((li) => {
      li.classList.toggle('selected', li.dataset.tab === tab);
    });

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
   * 外部设置匹配结果
   */
  setMatches(matches) {
    this.matches = matches;
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
      const lines = this.matches.map((m) => applyTemplate(this.extractTemplate, m));
      result.textContent = lines.join('\n');
    } else if (this.activeTab === 'replace') {
      // 替换全文（需要原文，由 main.js 注入）
      if (this.onReplacePreview) {
        result.textContent = this.onReplacePreview(this.replaceTemplate, this.matches);
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

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
