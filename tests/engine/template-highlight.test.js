import { describe, it, expect } from 'vitest';
import { htmlWithTemplateHighlight } from '../../src/engine/template-highlight.js';

describe('htmlWithTemplateHighlight', () => {
  it('高亮 $& $0 $1', () => {
    const html = htmlWithTemplateHighlight('[$&] $0 $1');
    expect(html).toContain('class="tpl-ref"');
    // $& 进 HTML 后 & 被转义为 &amp;，页面仍显示 $&
    expect(html).toContain('$&amp;');
    expect(html.match(/tpl-ref/g)?.length).toBe(3);
  });

  it('高亮 $`（匹配前）与 $\'（匹配后）为 tpl-ref', () => {
    // 与 applyTemplate 的 $` / $' 对称，防止 tokenizer 漏标
    const html = htmlWithTemplateHighlight("$`X$'");
    expect(html).toContain('class="tpl-ref"');
    expect(html.match(/tpl-ref/g)?.length).toBe(2);
    expect(html).toContain('$`');
    expect(html).toContain("$'");
    expect(html).toContain('class="tpl-text"');
    expect(html).toContain('>X<');
  });

  it('高亮 ${name}', () => {
    const html = htmlWithTemplateHighlight('${ext}');
    expect(html).toContain('class="tpl-named"');
    expect(html).toContain('${ext}');
  });

  it('高亮 \\n \\t', () => {
    const html = htmlWithTemplateHighlight('$&\\n\\t');
    expect(html).toContain('class="tpl-esc"');
    expect(html.match(/tpl-esc/g)?.length).toBe(2);
  });

  it('字面空格仍是 space-dot', () => {
    const html = htmlWithTemplateHighlight('a b');
    expect(html).toContain('class="space-dot"');
    expect(html.match(/space-dot/g)?.length).toBe(1);
  });

  it('字面量包 tpl-text 并转义 HTML', () => {
    const html = htmlWithTemplateHighlight('<<$&>>');
    expect(html).toContain('class="tpl-text"');
    expect(html).toContain('&lt;&lt;');
    expect(html).toContain('&gt;&gt;');
    expect(html).not.toContain('<<');
  });

  it('$10 整段为数字引用（不拆成 $1 + 0）', () => {
    const html = htmlWithTemplateHighlight('$10');
    expect(html).toBe('<span class="tpl-ref">$10</span>');
  });

  it('未闭合 ${ 当字面处理', () => {
    const html = htmlWithTemplateHighlight('${');
    expect(html).not.toContain('tpl-named');
    expect(html).toContain('tpl-text');
  });

  it('空串', () => {
    expect(htmlWithTemplateHighlight('')).toBe('');
    expect(htmlWithTemplateHighlight(null)).toBe('');
  });
});
