import { wrap, transfer } from 'comlink';

let workerInstance = null;
let api = null;

// 检测是否在浏览器环境（有 Worker 支持）
const hasWorkerSupport = typeof Worker !== 'undefined';

// 大文本阈值（>1MB 使用 Transferable）
const LARGE_TEXT_THRESHOLD = 1_000_000;

/**
 * 懒初始化 Worker（首次调用时才创建）
 */
async function getApi() {
  if (!hasWorkerSupport) {
    return null;
  }
  if (!api) {
    workerInstance = new Worker(
      new URL('./regex-worker.js', import.meta.url),
      { type: 'module' }
    );
    api = wrap(workerInstance);
  }
  return api;
}

/**
 * 执行正则匹配（异步）。
 *
 * @param {string} pattern
 * @param {string} flags
 * @param {string} text
 * @returns {Promise<{matches: Array, error?: Object}>}
 */
export async function solveRegex(pattern, flags, text) {
  try {
    // Node 测试环境：直接调用 solve 函数
    if (!hasWorkerSupport) {
      const { solve } = await import('./regex-worker.js');
      return solve(pattern, flags, text);
    }
    // 浏览器环境：通过 Worker
    const remote = await getApi();
    // 大文本使用 Transferable Objects（零拷贝）
    if (text.length > LARGE_TEXT_THRESHOLD) {
      const buffer = new TextEncoder().encode(text).buffer;
      return await remote.solveBuffer(transfer(buffer, [buffer]), pattern, flags);
    }
    return await remote.solve(pattern, flags, text);
  } catch (err) {
    return { matches: [], error: { message: err.message } };
  }
}

/**
 * 终止 Worker（用于主题切换或卸载时清理）
 */
export function terminateWorker() {
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
    api = null;
  }
}
