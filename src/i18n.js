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

/**
 * Fetch-based equivalent of queueLocaleLoads+initLocales, for contexts with no Phaser
 * scene to drive a load — the level editor is a plain static page (see src/editor/main.js,
 * which already fetches assets/images/platform-textures.json directly for the same
 * reason). Same `dictionaries`/`currentLang` state as the game, so language choice is
 * shared across editor and game tabs (same origin, same localStorage key).
 */
export async function initLocalesViaFetch() {
  await Promise.all(
    SUPPORTED_LANGS.map(async (lang) => {
      try {
        const res = await fetch(LOCALE_PATH(lang));
        dictionaries[lang] = await res.json();
      } catch (err) {
        console.error(`Failed to load locale '${lang}':`, err);
        dictionaries[lang] = dictionaries[lang] || {};
      }
    })
  );
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
