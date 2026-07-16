const SUPPORTED_LANGS = ['en', 'pt'];
const STORAGE_KEY = 'lang';
const LOCALE_PATH = (lang) => `src/locales/${lang}.json`;
const cacheKeyFor = (lang) => `locale_${lang}`;

const dictionaries = {};
let currentLang = localStorage.getItem(STORAGE_KEY) || 'en';
if (!SUPPORTED_LANGS.includes(currentLang)) currentLang = 'en';

/** Call from an early scene's preload() to queue every supported locale JSON. */
export function queueLocaleLoads(scene) {
  SUPPORTED_LANGS.forEach((lang) => scene.load.json(cacheKeyFor(lang), LOCALE_PATH(lang)));
}

/** Call once, after the locale JSON files have finished loading, to populate the dictionaries. */
export function initLocales(scene) {
  SUPPORTED_LANGS.forEach((lang) => {
    dictionaries[lang] = scene.cache.json.get(cacheKeyFor(lang)) || {};
  });
}

export function getLanguage() {
  return currentLang;
}

export function getSupportedLanguages() {
  return SUPPORTED_LANGS.slice();
}

export function setLanguage(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) return;
  currentLang = lang;
  localStorage.setItem(STORAGE_KEY, lang);
}

/** Look up `key` in the current language's dictionary; falls back to the key itself. */
export function t(key) {
  const dict = dictionaries[currentLang] || {};
  return dict[key] || key;
}
