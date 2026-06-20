const MAX_ITER = 10000;
const MAX_TIME_MS = 100;

/**
 * 在 Worker 中执行正则匹配。
 *
 * @param {string} pattern - 正则表达式
 * @param {string} flags - 标志位（g/i/m/s/u/y 组合）
 * @param {string} text - 待匹配文本
 * @returns {{ matches: Array, error?: { message: string, warning?: boolean } }}
 */
export function solve(pattern, flags, text) {
  if (!pattern) {
    return { matches: [] };
  }

  let re;
  try {
    re = new RegExp(pattern, flags);
  } catch (err) {
    return { matches: [], error: { message: err.message } };
  }

  const matches = [];
  let iter = 0;
  const start = performance.now();
  let m;

  try {
    while ((m = re.exec(text)) !== null) {
      const matchLength = m[0].length;
      
      // 处理空匹配：跳过当前字符，避免无限循环
      if (matchLength === 0) {
        // 如果当前字符是换行符，跳过它（因为 . 不匹配换行）
        if (text[re.lastIndex] === '\n') {
          re.lastIndex++;
        } else {
          re.lastIndex++;
        }
        // 空匹配不添加到结果中
        continue;
      }
      
      // 防空匹配死循环：零宽匹配时推进 lastIndex
      if (re.lastIndex === m.index) {
        re.lastIndex++;
      }

      // 安全退出
      if (++iter > MAX_ITER || performance.now() - start > MAX_TIME_MS) {
        return {
          matches,
          error: {
            message: `匹配中断（超过 ${MAX_ITER} 次迭代或 ${MAX_TIME_MS}ms）`,
            warning: true,
          },
        };
      }

      // 构造 groups 数组（包含 $0）
      const groups = [];
      for (let i = 0; i < m.length; i++) {
        if (m[i] !== undefined) {
          groups.push({ index: i, value: m[i] });
        }
      }

      matches.push({
        index: m.index,
        length: matchLength,
        full: m[0],
        groups,
        namedGroups: m.groups ?? {},
      });

      if (!re.global) break;
    }
  } catch (err) {
    return {
      matches,
      error: { message: `执行错误: ${err.message}` },
    };
  }

  return { matches };
}

/**
 * 接受 ArrayBuffer（Transferable），避免大文本拷贝开销。
 */
export function solveBuffer(buffer, pattern, flags) {
  const text = new TextDecoder().decode(buffer);
  return solve(pattern, flags, text);
}

// Worker 环境时才 expose（Node 测试环境时不执行）
if (typeof self !== 'undefined' && typeof window === 'undefined' && typeof process === 'undefined') {
  import('comlink').then(({ expose }) => {
    expose({ solve, solveBuffer });
  });
}
