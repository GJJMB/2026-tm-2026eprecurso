import { putAsset } from './db.js';

/**
 * Binary asset storage on top of db.js's `assets` IndexedDB store: images and audio
 * clips, base64-encoded so they can live as plain JSON-serializable records (same
 * approach as sections/levels/campaigns) rather than needing IDB's separate Blob
 * storage path. Two supported kinds only, matching what the game/editor can actually
 * consume: no video.
 */

export const ASSET_KIND = { IMAGE: 'image', AUDIO: 'audio' };

const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg'];
const AUDIO_MIME_TYPES = ['audio/mpeg', 'audio/ogg'];

// Some platforms/pickers leave File.type empty for less-common formats (seen historically
// with .ogg): this fills in from the extension only when the browser gave us nothing.
const EXTENSION_MIME_FALLBACK = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
};

export const MAX_IMAGE_BYTES = 128 * 1024; // 128KB
export const MAX_AUDIO_BYTES = 1024 * 1024; // 1MB

function extensionOf(filename) {
  const idx = filename.lastIndexOf('.');
  return idx === -1 ? '' : filename.slice(idx + 1).toLowerCase();
}

function resolveMimeType(file) {
  if (file.type) return file.type;
  return EXTENSION_MIME_FALLBACK[extensionOf(file.name)] || '';
}

/** Throws a descriptive Error if `file` isn't an allowed image/audio type or exceeds its
 * kind's size cap; returns `{ kind, mimeType }` on success. Checked up front (before any
 * base64 conversion) so a rejected file never pays the encoding cost. */
export function validateAssetFile(file) {
  const mimeType = resolveMimeType(file);

  if (mimeType.startsWith('video/')) {
    throw new Error('Video files are not supported.');
  }
  if (IMAGE_MIME_TYPES.includes(mimeType)) {
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error(`Image files must be ${MAX_IMAGE_BYTES / 1024}KB or smaller (this file is ${Math.ceil(file.size / 1024)}KB).`);
    }
    return { kind: ASSET_KIND.IMAGE, mimeType };
  }
  if (AUDIO_MIME_TYPES.includes(mimeType)) {
    if (file.size > MAX_AUDIO_BYTES) {
      throw new Error(
        `Audio files must be ${MAX_AUDIO_BYTES / (1024 * 1024)}MB or smaller (this file is ${(file.size / (1024 * 1024)).toFixed(2)}MB).`
      );
    }
    return { kind: ASSET_KIND.AUDIO, mimeType };
  }
  throw new Error(`Unsupported file type '${mimeType || 'unknown'}'. Allowed: PNG/JPEG images, MP3/OGG audio.`);
}

/** Reads `file` into a bare base64 string (no `data:...;base64,` prefix: see
 * assetToDataUrl for that). Goes through FileReader rather than
 * `arrayBuffer()` + `btoa(String.fromCharCode(...))`, since spreading a large byte array
 * into `String.fromCharCode` blows the call stack well before either size cap here. */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result); // "data:<mime>;base64,<data>"
      const commaIdx = result.indexOf(',');
      resolve(commaIdx === -1 ? result : result.slice(commaIdx + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Validates, base64-encodes, and stores `file` under `id` (overwriting any existing
 * asset with that id: same upsert-by-id model as sections/levels/campaigns). `name`
 * defaults to the file's own filename. Returns the stored record. */
export async function saveAssetFile(id, file, name) {
  const { kind, mimeType } = validateAssetFile(file);
  const dataBase64 = await fileToBase64(file);
  const asset = { id, name: name || file.name, kind, mimeType, size: file.size, dataBase64 };
  await putAsset(asset);
  return asset;
}

/** A `data:` URL for a stored asset: directly usable as an `<img src>`/`<audio src>`, or
 * with Phaser's `load.image`/`load.audio`, with no separate file ever written to disk. */
export function assetToDataUrl(asset) {
  return `data:${asset.mimeType};base64,${asset.dataBase64}`;
}
