/**
 * 防抖函数。在最后一次调用后等待 delay 毫秒才执行。
 * 返回的函数有 .cancel() 方法用于取消待执行调用。
 */
export function debounce(fn, delay) {
  let timer = null;
  const debounced = function (...args) {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn.apply(this, args);
    }, delay);
  };
  debounced.cancel = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };
  return debounced;
}
