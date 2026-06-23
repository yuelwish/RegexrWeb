import { toggleTheme } from '../utils/theme.js';

export function renderHeader(container) {
  container.innerHTML = `
    <div class="app-header">
      <div class="logo-wrap">
        <svg class="logo" viewBox="0 0 64 64" aria-hidden="true">
          <path d="M0 0v64h64V0H0zm23.799 52.045H11.783V40.029h12.016v12.016zm29.957-22.401l-5.396 5.235-6.765-11.033L34.67 35.12l-5.396-5.235 9.744-7.328-13.046-4.188 3.785-6.604 10.711 8.617L37.65 7.739h7.57l-2.899 12.643 10.791-8.617 3.785 6.604-12.804 4.027 9.663 7.248z" fill="currentColor"/>
        </svg>
        <span>RegExr</span>
      </div>
      <ul class="etc">
        <li>
          <button class="theme-btn" type="button" title="Toggle theme" id="themeToggle">
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 3a9 9 0 109 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 01-4.4 2.26 5.403 5.403 0 01-3.14-9.8c-.44-.06-.9-.1-1.36-.1z" fill="currentColor"/>
            </svg>
          </button>
        </li>
        <li><a href="https://github.com/yuelwish/RegexrWeb" target="_blank" rel="noopener">GitHub</a></li>
      </ul>
    </div>
  `;

  // 事件绑定
  document.getElementById('themeToggle').addEventListener('click', () => {
    toggleTheme();
  });
}
