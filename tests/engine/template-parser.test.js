import { describe, it, expect } from 'vitest';
import { applyTemplate } from '../../src/engine/template-parser.js';

// 构造一个 fake match 对象,模拟 regex-worker 输出
const makeMatch = (full, groups = [], namedGroups = {}) => ({
  full,
  groups: groups.map((value, index) => ({ index, value })),
  namedGroups,
});

describe('applyTemplate', () => {
  it('替换 $0 为完整匹配', () => {
    const m = makeMatch('hello world');
    expect(applyTemplate('[$0]', m)).toBe('[hello world]');
  });

  it('替换 $1 $2 为捕获组', () => {
    const m = makeMatch('photo.jpg', ['', 'jpg']); // $0=full, $1=jpg
    expect(applyTemplate('$1 - $0', m)).toBe('jpg - photo.jpg');
  });

  it('多个相同占位符都替换', () => {
    const m = makeMatch('a', ['', 'x']);
    expect(applyTemplate('$1,$1,$1', m)).toBe('x,x,x');
  });

  it('捕获组不存在时替换为空字符串', () => {
    const m = makeMatch('hello', []);
    expect(applyTemplate('$1-$99', m)).toBe('-');
  });

  it('替换 \\n 为换行符', () => {
    const m = makeMatch('x');
    expect(applyTemplate('a\\nb', m)).toBe('a\nb');
  });

  it('替换 \\t 为 Tab', () => {
    const m = makeMatch('x');
    expect(applyTemplate('a\\tb', m)).toBe('a\tb');
  });

  it('替换 ${name} 为命名捕获组', () => {
    const m = makeMatch('jpg', ['', 'jpg'], { ext: 'jpg' });
    expect(applyTemplate('[${ext}]', m)).toBe('[jpg]');
  });

  it('命名捕获组不存在时替换为空字符串', () => {
    const m = makeMatch('x', [], {});
    expect(applyTemplate('${missing}', m)).toBe('');
  });

  it('混合使用多种占位符', () => {
    const m = makeMatch('https://a.com/p.jpg', ['', 'jpg'], { ext: 'jpg' });
    expect(applyTemplate('$1 | ${ext} | $0', m))
      .toBe('jpg | jpg | https://a.com/p.jpg');
  });

  it('模板为空字符串时返回空', () => {
    const m = makeMatch('x');
    expect(applyTemplate('', m)).toBe('');
  });

  it('替换 $& 为完整匹配（JavaScript 标准写法）', () => {
    const m = makeMatch('hello world');
    expect(applyTemplate('[$&]', m)).toBe('[hello world]');
  });

  it('$& 和 $0 效果相同', () => {
    const m = makeMatch('test');
    expect(applyTemplate('$&', m)).toBe(applyTemplate('$0', m));
  });

  it('替换 $` 为匹配前的文本', () => {
    const m = makeMatch('world', [], {});
    m.text = 'hello world!';
    // $0 的 index 默认是 0（makeMatch 不设置 index），需要手动设置
    m.groups = [{ index: 6, value: 'world' }];
    m.full = 'world';
    expect(applyTemplate('before=[$`]', m)).toBe('before=[hello ]');
  });

  it("替换 $' 为匹配后的文本", () => {
    const m = makeMatch('world', [], {});
    m.text = 'hello world!';
    m.groups = [{ index: 6, value: 'world' }];
    m.full = 'world';
    expect(applyTemplate("after=[$']", m)).toBe('after=[!]');
  });
});
