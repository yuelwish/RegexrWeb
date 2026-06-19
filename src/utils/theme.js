const STORAGE_KEY = 'regexr-theme';

export function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  const theme = saved === 'light' ? 'light' : 'dark'; // 默认深色
  applyTheme(theme);
  return theme;
}

export function toggleTheme() {
  const current = document.documentElement.dataset.theme || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem(STORAGE_KEY, next);
  return next;
}

function applyTheme(theme) {
  if (theme === 'light') {
    document.documentElement.dataset.theme = 'light';
  } else {
    delete document.documentElement.dataset.theme;
  }
}
