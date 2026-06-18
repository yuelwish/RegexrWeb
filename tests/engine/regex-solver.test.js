import { describe, it, expect, afterEach } from 'vitest';
import { solveRegex, terminateWorker } from '../../src/engine/regex-solver.js';

describe('regex-solver (main thread)', () => {
  // 每次测试后清理 Worker
  afterEach(() => {
    terminateWorker();
  });

  it('空模式返回空数组', async () => {
    console.log('Testing empty pattern...');
    const result = await solveRegex('', 'g', 'hello world');
    console.log('Empty pattern result:', result);
    expect(result.matches).toEqual([]);
  });

  it('简单匹配', async () => {
    console.log('Testing simple match...');
    const result = await solveRegex('world', 'g', 'hello world!');
    console.log('Simple match result:', result);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].full).toBe('world');
    expect(result.matches[0].index).toBe(6);
  });

  it('多匹配', async () => {
    const result = await solveRegex('\\d+', 'g', '1 and 2 and 3');
    expect(result.matches).toHaveLength(3);
    expect(result.matches.map(m => m.full)).toEqual(['1', '2', '3']);
  });

  it('捕获组', async () => {
    const result = await solveRegex('(\\w+)@(\\w+)', 'g', 'a@b c@d');
    expect(result.matches).toHaveLength(2);
    expect(result.matches[0].groups).toEqual([
      { index: 0, value: 'a@b' },
      { index: 1, value: 'a' },
      { index: 2, value: 'b' },
    ]);
  });

  it('正则语法错误时返回 error', async () => {
    const result = await solveRegex('[unclosed', 'g', 'text');
    expect(result.error).toBeDefined();
    expect(result.matches).toEqual([]);
  });

  it('Worker 懒初始化（首次调用才创建）', async () => {
    // 第一次调用前，Worker 未初始化
    const result1 = await solveRegex('a', 'g', 'abc');
    expect(result1.matches).toHaveLength(1);
    // 第二次调用复用同一 Worker
    const result2 = await solveRegex('b', 'g', 'abc');
    expect(result2.matches).toHaveLength(1);
    // terminateWorker 后 Worker 被销毁
    terminateWorker();
    const result3 = await solveRegex('c', 'g', 'abc');
    expect(result3.matches).toHaveLength(1);
  });
});
