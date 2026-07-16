const MANIFEST_KEY = 'platformTextures';
const MANIFEST_PATH = 'assets/images/platform-textures.json';
const IMAGE_BASE_PATH = 'assets/images/';

/**
 * Optional sprite textures a platform/tile can use instead of a flat color, driven by
 * assets/images/platform-textures.json: { "key": "file.png" }. Adding a texture option is
 * a JSON edit + image drop, not a code change — see levelFormat.js for how entities/tile
 * styles reference a texture by this key.
 */
export default class PlatformTextures {
  /** Call from an early scene's preload() to fetch the manifest itself. */
  static queueManifestLoad(scene) {
    scene.load.json(MANIFEST_KEY, MANIFEST_PATH);
  }

  /** Call from a later scene's preload() (after the manifest has finished loading). */
  static queueImageLoads(scene) {
    const manifest = scene.cache.json.get(MANIFEST_KEY) || {};
    for (const [key, file] of Object.entries(manifest)) {
      if (!scene.textures.exists(key)) {
        scene.load.image(key, IMAGE_BASE_PATH + file);
      }
    }
  }

  /** Every available texture key — e.g. for populating the editor's sprite picker. */
  static keys(scene) {
    return Object.keys(scene.cache.json.get(MANIFEST_KEY) || {});
  }
}
