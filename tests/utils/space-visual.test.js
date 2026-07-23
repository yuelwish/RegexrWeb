import { describe, it, expect, vi } from 'vitest';
import {
  wrapInvisibleChar,
  htmlWithSpaceDots,
  bindSpaceDotOverlay,
} from '../../src/utils/space-visual.js';

describe('wrapInvisibleChar', () => {
  it('空格包 space-dot', () => {
    expect(wrapInvisibleChar(' ')).toBe('<span class="space-dot"> </span>');
  });

  it('Tab 包 tab-dot', () => {
    expect(wrapInvisibleChar('\t')).toBe('<span class="tab-dot">\t</span>');
  });

  it('可附加 extraClass（Expression tk-char）', () => {
    expect(wrapInvisibleChar(' ', 'tk-char')).toBe(
      '<span class="space-dot tk-char"> </span>'
    );
  });

  it('普通字符返回 null', () => {
    expect(wrapInvisibleChar('a')).toBeNull();
    expect(wrapInvisibleChar('<')).toBeNull();
  });
});

describe('htmlWithSpaceDots', () => {
  it('空格与 Tab 转 span，普通字转义', () => {
    const html = htmlWithSpaceDots('a  b\t<x>');
    expect(html).toContain('<span class="space-dot"> </span>');
    expect(html.match(/space-dot/g)?.length).toBe(2);
    expect(html).toContain('<span class="tab-dot">\t</span>');
    expect(html).toContain('&lt;');
    expect(html).toContain('&gt;');
    expect(html).not.toContain('<x>');
  });

  it('null/undefined 当空串', () => {
    expect(htmlWithSpaceDots(null)).toBe('');
    expect(htmlWithSpaceDots(undefined)).toBe('');
  });

  it('连续空格个数与 span 数一致（advance 不变量的 HTML 侧）', () => {
    const n = 20;
    const html = htmlWithSpaceDots('x' + ' '.repeat(n));
    expect(html.match(/class="space-dot"/g)?.length).toBe(n);
  });
});

describe('bindSpaceDotOverlay', () => {
  function mountPair() {
    const wrap = document.createElement('div');
    const input = document.createElement('input');
    const overlay = document.createElement('div');
    wrap.append(input, overlay);
    document.body.appendChild(wrap);
    return { input, overlay, wrap };
  }

  it('初始与 input 同步，input 事件刷新 overlay', () => {
    const { input, overlay, wrap } = mountPair();
    const { destroy } = bindSpaceDotOverlay(input, overlay);
    input.value = 'a b';
    input.dispatchEvent(new Event('input'));
    expect(overlay.querySelectorAll('.space-dot').length).toBe(1);
    expect(overlay.textContent).toBe('a b');
    destroy();
    wrap.remove();
  });

  it('onInput 与 sync 同一次 input 触发（合并监听）', () => {
    const { input, overlay, wrap } = mountPair();
    const onInput = vi.fn();
    const { destroy } = bindSpaceDotOverlay(input, overlay, { onInput });
    input.value = '  ';
    input.dispatchEvent(new Event('input'));
    expect(onInput).toHaveBeenCalledTimes(1);
    expect(onInput).toHaveBeenCalledWith('  ');
    expect(overlay.querySelectorAll('.space-dot').length).toBe(2);
    destroy();
    wrap.remove();
  });

  it('destroy 后不再更新', () => {
    const { input, overlay, wrap } = mountPair();
    const { destroy } = bindSpaceDotOverlay(input, overlay);
    destroy();
    input.value = 'x y';
    input.dispatchEvent(new Event('input'));
    expect(overlay.innerHTML).toBe('');
    wrap.remove();
  });

  it('sync() 可手动刷新（tab 切换写 value）', () => {
    const { input, overlay, wrap } = mountPair();
    const { sync, destroy } = bindSpaceDotOverlay(input, overlay);
    input.value = 'p q';
    sync();
    expect(overlay.querySelectorAll('.space-dot').length).toBe(1);
    destroy();
    wrap.remove();
  });
});
