import { t, getLanguage, setLanguage, getSupportedLanguages } from '../i18n.js';
import { getAllCampaigns } from '../data/db.js';

const mainMenuEl = document.getElementById('main-menu');
const pauseMenuEl = document.getElementById('pause-menu');

const mmTitle = document.getElementById('mm-title');
const mmStart = document.getElementById('mm-start');
const mmLangLabel = document.getElementById('mm-lang-label');
const mmLangButtons = document.getElementById('mm-lang-buttons');
const mmCampaignLabel = document.getElementById('mm-campaign-label');
const mmCampaignButtons = document.getElementById('mm-campaign-buttons');
const mmCampaignEmpty = document.getElementById('mm-campaign-empty');
const mmEditorLink = document.getElementById('mm-editor-link');

// Which campaign (an IndexedDB-authored, editor-built ordered list of levels — see
// src/data/db.js) is picked in the main menu, or null for "no campaign" (the built-in
// game). Reset every time the menu is (re)shown, per design: nothing is selected by
// default, so Start always falls back to the built-in game unless the player explicitly
// opts into a campaign this visit.
let selectedCampaignId = null;

function renderCampaignButtons(campaigns, onStart) {
  mmCampaignButtons.innerHTML = '';
  mmCampaignEmpty.classList.toggle('hidden', campaigns.length > 0);
  if (campaigns.length === 0) {
    mmCampaignEmpty.textContent = t('menu.campaignsEmpty');
    return;
  }
  campaigns.forEach((campaign) => {
    const btn = document.createElement('button');
    btn.className = 'campaign-btn' + (campaign.id === selectedCampaignId ? ' active' : '');
    btn.textContent = campaign.name;
    btn.addEventListener('click', () => {
      selectedCampaignId = selectedCampaignId === campaign.id ? null : campaign.id;
      renderCampaignButtons(campaigns, onStart);
    });
    mmCampaignButtons.appendChild(btn);
  });
}

const pmTitle = document.getElementById('pm-title');
const pmRestart = document.getElementById('pm-restart');
const pmLeave = document.getElementById('pm-leave');
const pmClose = document.getElementById('pm-close');

const gameOverMenuEl = document.getElementById('game-over-menu');
const goTitle = document.getElementById('go-title');
const goNext = document.getElementById('go-next');
const goRestart = document.getElementById('go-restart');
const goHint = document.getElementById('go-hint');

/**
 * Shows the HTML main menu and wires its Start button + language switcher + campaign
 * picker + editor link. `onStart(campaignId)` is called with the selected campaign's id,
 * or null when none is picked (plays the built-in game, today's default, unchanged).
 */
export function showMainMenu({ onStart }) {
  mmTitle.textContent = t('menu.title');
  mmStart.textContent = t('menu.start');
  mmLangLabel.textContent = t('menu.language');
  mmCampaignLabel.textContent = t('menu.campaigns');
  mmEditorLink.textContent = t('menu.editorLink');

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

  // Nothing is selected by default — reset every time the menu is (re)shown.
  selectedCampaignId = null;
  mmCampaignButtons.innerHTML = '';
  mmCampaignEmpty.classList.add('hidden');
  getAllCampaigns()
    .then((campaigns) => renderCampaignButtons(campaigns, onStart))
    .catch((err) => console.error('Failed to load campaigns:', err));

  mmStart.onclick = () => {
    hideMainMenu();
    onStart(selectedCampaignId);
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

/**
 * Shows the HTML game-over/win overlay and wires its Restart button, plus a Next Level
 * button when `onNext` is given (only possible on a win with a level after this one in
 * assets/levels/levels.json's sequence — see LevelLoader.getNextLevelKey).
 */
export function showGameOverMenu({ won, onRestart, onNext }) {
  goTitle.textContent = won ? t('gameover.win') : t('gameover.lose');
  goTitle.classList.toggle('win', won);
  goTitle.classList.toggle('lose', !won);

  const hasNext = Boolean(onNext);
  goNext.classList.toggle('hidden', !hasNext);
  goNext.classList.toggle('primary', hasNext);
  goRestart.classList.toggle('primary', !hasNext);

  goNext.textContent = t('gameover.next');
  goRestart.textContent = t('pause.restart');
  goHint.textContent = t('gameover.restart');

  goNext.onclick = hasNext ? () => onNext() : null;
  goRestart.onclick = () => onRestart();

  gameOverMenuEl.classList.remove('hidden');
}

export function hideGameOverMenu() {
  gameOverMenuEl.classList.add('hidden');
}
