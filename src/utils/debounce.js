/**
 * 防抖函数。在最后一次调用后等待 delay 毫秒才执行。
 */
export function debounce(fn, delay) {
  let timer = null;
  return function (...args) {
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn.apply(this, args);
    }, delay);
  };
}
