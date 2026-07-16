const MANIFEST_KEY = 'parallaxSets';
const MANIFEST_PATH = 'assets/images/parallax-sets.json';
const IMAGE_BASE_PATH = 'assets/images/';

/**
 * Scrolling backdrop, driven entirely by assets/images/parallax-sets.json:
 * { "setKey": [{ key, file, factor, depth }, ...] }. A scene picks its backdrop by
 * setKey (e.g. one per level) and can swap it later via setLayerSet(). Adding a new
 * level's backdrop is a JSON edit + image drop, not a code change.
 */
export default class ParallaxBackground {
  /** Call from an early scene's preload() to fetch the manifest itself. */
  static queueManifestLoad(scene) {
    scene.load.json(MANIFEST_KEY, MANIFEST_PATH);
  }

  /**
   * Call from a later scene's preload() (after the manifest has finished loading) to
   * queue the images for `setKey`, or every set in the manifest if `setKey` is omitted.
   */
  static queueImageLoads(scene, setKey) {
    const manifest = scene.cache.json.get(MANIFEST_KEY) || {};
    const setKeys = setKey ? [setKey] : Object.keys(manifest);
    for (const key of setKeys) {
      for (const layer of manifest[key] || []) {
        if (!scene.textures.exists(layer.key)) {
          scene.load.image(layer.key, IMAGE_BASE_PATH + layer.file);
        }
      }
    }
  }

  constructor(scene, setKey) {
    this.scene = scene;
    this.setKey = null;
    this.layers = [];
    this.setLayerSet(setKey);
  }

  /** Switch to a different (already-loaded) layer set, tearing down the previous one. */
  setLayerSet(setKey) {
    const manifest = this.scene.cache.json.get(MANIFEST_KEY) || {};
    const defs = manifest[setKey];
    if (!defs) {
      console.warn(`ParallaxBackground: no layer set "${setKey}" in ${MANIFEST_PATH}`);
      return;
    }

    this.destroy();
    this.setKey = setKey;

    const { width, height } = this.scene.scale;
    this.layers = defs.map(({ key, factor, depth }) => ({
      sprite: this.scene.add
        .tileSprite(0, 0, width, height, key)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(depth),
      factor,
    }));
  }

  /** Call every frame with the camera's current scrollX. */
  update(scrollX) {
    for (const { sprite, factor } of this.layers) {
      sprite.tilePositionX = scrollX * factor;
    }
  }

  destroy() {
    for (const { sprite } of this.layers) sprite.destroy();
    this.layers = [];
  }
}
