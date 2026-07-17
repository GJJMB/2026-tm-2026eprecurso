import { t, getLanguage, setLanguage } from '../i18n.js';
import { els } from './dom.js';
import { renderFgToolButtons, renderBgToolButtons } from './toolbar.js';
import { renderTilesetFields } from './tilesetPanel.js';
import { renderEntityList, renderPlatformList, renderBgList } from './objectLists.js';
import { renderInspector } from './inspector.js';
import { renderCampaignLevelList, renderAssetList } from './campaigns.js';

// --- Localization (flag toggle, top-right of the top bar: see editor.html) ---
//
// The editor is plain static JS, not a Phaser scene (same reasoning as textureLoader.js's
// fetch), so it can't use i18n.js's normal queueLocaleLoads/initLocales pair (those drive
// off a Phaser scene's load queue/cache): initLocalesViaFetch() (called from main.js) is
// the fetch-based equivalent for exactly this kind of context. `t`/`getLanguage`/
// `setLanguage` are otherwise identical to the game's usage, including sharing the same
// localStorage key, so a language picked in one tab is picked up by the other next time
// it loads.

function syncLangButtons() {
  const lang = getLanguage();
  els.langEnBtn.classList.toggle('active', lang === 'en');
  els.langPtBtn.classList.toggle('active', lang === 'pt');
}

/** Applies the current language to every static piece of markup carrying a data-i18n
 * (textContent) or data-i18n-placeholder (placeholder) attribute: see editor.html. */
export function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.documentElement.lang = getLanguage();
  syncLangButtons();
}

/** Re-renders every panel whose text is built in JS rather than sitting in static HTML
 * (entity/tool labels, tileset names, inspector fields, campaign list, ...): these don't
 * carry data-i18n attributes, so applyTranslations() alone can't refresh them. Only needed
 * after an explicit language switch; on first load, loadState()/initLocalLibrary() already
 * render everything fresh once the dictionaries are in place. */
export function refreshDynamicLabels() {
  renderFgToolButtons();
  renderBgToolButtons();
  renderTilesetFields();
  renderEntityList();
  renderPlatformList();
  renderBgList();
  renderInspector();
  renderCampaignLevelList();
  renderAssetList();
}

export function setLang(lang) {
  if (lang === getLanguage()) return;
  setLanguage(lang);
  applyTranslations();
  refreshDynamicLabels();
}

els.langEnBtn.addEventListener('click', () => setLang('en'));
els.langPtBtn.addEventListener('click', () => setLang('pt'));
