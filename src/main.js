import { initTheme } from './utils/theme.js';
import { renderHeader } from './ui/header.js';

initTheme();
renderHeader(document.getElementById('appHeader'));
