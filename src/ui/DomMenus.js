import { t, getLanguage, setLanguage, getSupportedLanguages } from '../i18n.js';

const mainMenuEl = document.getElementById('main-menu');
const pauseMenuEl = document.getElementById('pause-menu');

const mmTitle = document.getElementById('mm-title');
const mmStart = document.getElementById('mm-start');
const mmLangLabel = document.getElementById('mm-lang-label');
const mmLangButtons = document.getElementById('mm-lang-buttons');

const pmTitle = document.getElementById('pm-title');
const pmRestart = document.getElementById('pm-restart');
const pmLeave = document.getElementById('pm-leave');
const pmClose = document.getElementById('pm-close');

const gameOverMenuEl = document.getElementById('game-over-menu');
const goTitle = document.getElementById('go-title');
const goRestart = document.getElementById('go-restart');
const goHint = document.getElementById('go-hint');

/** Shows the HTML main menu and wires its Start button + language switcher. */
export function showMainMenu({ onStart }) {
  mmTitle.textContent = t('menu.title');
  mmStart.textContent = t('menu.start');
  mmLangLabel.textContent = t('menu.language');

  mmLangButtons.innerHTML = '';
  getSupportedLanguages().forEach((lang) => {
    const btn = document.createElement('button');
    btn.className = 'lang-btn' + (lang === getLanguage() ? ' active' : '');
    btn.textContent = lang.toUpperCase();
    btn.addEventListener('click', () => {
      if (lang === getLanguage()) return;
      setLanguage(lang);
      showMainMenu({ onStart });
    });
    mmLangButtons.appendChild(btn);
  });

  mmStart.onclick = () => {
    hideMainMenu();
    onStart();
  };

  mainMenuEl.classList.remove('hidden');
}

export function hideMainMenu() {
  mainMenuEl.classList.add('hidden');
}

/** Shows the HTML pause menu (ESC) and wires its Close/Restart/Leave buttons. */
export function showPauseMenu({ onResume, onRestart, onLeave }) {
  pmTitle.textContent = t('pause.title');
  pmRestart.textContent = t('pause.restart');
  pmLeave.textContent = t('pause.leave');

  pmClose.onclick = () => {
    hidePauseMenu();
    onResume();
  };
  pmRestart.onclick = () => {
    hidePauseMenu();
    onRestart();
  };
  pmLeave.onclick = () => {
    hidePauseMenu();
    onLeave();
  };

  pauseMenuEl.classList.remove('hidden');
}

export function hidePauseMenu() {
  pauseMenuEl.classList.add('hidden');
}

export function isPauseMenuVisible() {
  return !pauseMenuEl.classList.contains('hidden');
}

/** Shows the HTML game-over/win overlay and wires its Restart button. */
export function showGameOverMenu({ won, onRestart }) {
  goTitle.textContent = won ? t('gameover.win') : t('gameover.lose');
  goTitle.classList.toggle('win', won);
  goTitle.classList.toggle('lose', !won);
  goRestart.textContent = t('pause.restart');
  goHint.textContent = t('gameover.restart');

  goRestart.onclick = () => onRestart();

  gameOverMenuEl.classList.remove('hidden');
}

export function hideGameOverMenu() {
  gameOverMenuEl.classList.add('hidden');
}
