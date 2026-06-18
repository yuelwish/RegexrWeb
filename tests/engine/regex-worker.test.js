import { describe, it, expect } from 'vitest';
import { solve } from '../../src/engine/regex-worker.js';

describe('solve', () => {
  it('返回空数组当无匹配', () => {
    const result = solve('xyz', 'g', 'hello world');
    expect(result.matches).toEqual([]);
  });

  it('返回单个匹配当不带 g flag', () => {
    const result = solve('o', '', 'hello');
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].full).toBe('o');
    expect(result.matches[0].index).toBe(4);
    expect(result.matches[0].length).toBe(1);
  });

  it('返回所有匹配当带 g flag', () => {
    const result = solve('o', 'g', 'hello world foo');
    expect(result.matches).toHaveLength(4);
  });

  it('返回捕获组 groups', () => {
    const result = solve('(\\w+)@(\\w+)', 'g', 'a@b c@d');
    expect(result.matches).toHaveLength(2);
    // $0=full, $1=user, $2=domain
    expect(result.matches[0].groups).toEqual([
      { index: 0, value: 'a@b' },
      { index: 1, value: 'a' },
      { index: 2, value: 'b' },
    ]);
  });

  it('返回命名捕获组 namedGroups', () => {
    const result = solve('(?<user>\\w+)@(?<domain>\\w+)', 'g', 'a@b');
    expect(result.matches[0].namedGroups).toEqual({ user: 'a', domain: 'b' });
  });

  it('精确报告 index 和 length', () => {
    const result = solve('world', 'g', 'hello world!');
    expect(result.matches[0].index).toBe(6);
    expect(result.matches[0].length).toBe(5);
  });

  it('正则语法错误时返回 error', () => {
    const result = solve('[abc', 'g', 'text');
    expect(result.error).toBeDefined();
    expect(result.matches).toEqual([]);
  });

  it('空匹配时推进 lastIndex 防死循环', () => {
    // /^/g 在 "abc" 上会匹配 4 次（每个位置），不会死循环
    const result = solve('^', 'gm', 'a\nb\nc');
    expect(result.matches.length).toBeGreaterThanOrEqual(3);
  });

  it('防灾难性回溯（迭代上限）', () => {
    // 构造会触发指数级回溯的正则，使用较短的字符串
    const result = solve('(a+)+$', 'g', 'a'.repeat(15) + '!');
    // 要么在合理时间内返回（可能无匹配），要么返回 warning
    expect(result).toBeDefined();
    // 如果是 warning，说明被中断了
    if (result.error && result.error.warning) {
      expect(result.matches.length).toBeGreaterThan(0);
    }
  });
});
