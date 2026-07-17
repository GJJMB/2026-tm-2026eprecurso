/**
 * Shared IndexedDB persistence for user-authored content: sections/levels (same shape as
 * the file-based assets/levels/* format — see levelFormat.js), campaigns (an ordered list
 * of level ids, new concept, not backed by any file), and binary assets (images/audio,
 * base64-encoded — see assets.js for validation/encoding). Used by both the editor
 * (src/editor/main.js, to author/save) and the game runtime (MenuScene/DomMenus, to list
 * and play campaigns) — this file lives outside src/editor/ specifically so both sides can
 * import it. editor.html and index.html are separate static pages with no shared build
 * step, but same-origin, so they share one browser-local database.
 *
 * Hand-rolled Promise wrapper around raw `indexedDB` rather than a library: this repo has
 * no bundler (see package.json — only devDependency is `serve`), so pulling in an IDB
 * helper package isn't practical, and raw IDB is small enough to wrap directly.
 */

const DB_NAME = 'stickman-editor';
const DB_VERSION = 2;

let dbPromise = null;

export function isIndexedDbAvailable() {
  return typeof indexedDB !== 'undefined';
}

/** Opens (once) and caches the database connection. Every store is keyed by `id`.
 * Structured as an `oldVersion` staircase (each `if` additive, never rewritten) so a
 * future version bump only ever adds a new block rather than touching this one. */
function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      if (event.oldVersion < 1) {
        for (const name of ['sections', 'levels', 'campaigns']) {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
        }
      }
      if (event.oldVersion < 2) {
        if (!db.objectStoreNames.contains('assets')) db.createObjectStore('assets', { keyPath: 'id' });
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      // A version bump from another tab can't apply while this connection is still open —
      // closing on notice lets that upgrade proceed instead of hanging indefinitely.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

/** Every CRUD helper opens its own transaction and resolves/rejects purely from that
 * transaction's own request — IDB auto-commits a transaction once the event loop goes
 * idle between requests, so nothing here ever awaits unrelated work mid-transaction. */
function runRequest(storeName, mode, fn) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const request = fn(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      })
  );
}

function getAll(storeName) {
  return runRequest(storeName, 'readonly', (store) => store.getAll());
}
function get(storeName, id) {
  return runRequest(storeName, 'readonly', (store) => store.get(id));
}
function put(storeName, value) {
  return runRequest(storeName, 'readwrite', (store) => store.put(value));
}
function del(storeName, id) {
  return runRequest(storeName, 'readwrite', (store) => store.delete(id));
}

export const getAllSections = () => getAll('sections');
export const getSection = (id) => get('sections', id);
export const putSection = (section) => put('sections', section);
export const deleteSection = (id) => del('sections', id);

export const getAllLevels = () => getAll('levels');
export const getLevel = (id) => get('levels', id);
export const putLevel = (level) => put('levels', level);
export const deleteLevel = (id) => del('levels', id);

export const getAllCampaigns = () => getAll('campaigns');
export const getCampaign = (id) => get('campaigns', id);
export const putCampaign = (campaign) => put('campaigns', campaign);
export const deleteCampaign = (id) => del('campaigns', id);

export const getAllAssets = () => getAll('assets');
export const getAsset = (id) => get('assets', id);
export const putAsset = (asset) => put('assets', asset);
export const deleteAsset = (id) => del('assets', id);

/** Auto-generated id for a new campaign — campaigns are named by the user, not id'd like
 * sections/levels (which reuse whatever id the user typed for the section/level itself). */
export function generateCampaignId() {
  return `campaign-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
