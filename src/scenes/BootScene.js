import SoundManager from '../audio/SoundManager.js';
import ParallaxBackground from '../world/ParallaxBackground.js';
import PlatformTextures from '../world/PlatformTextures.js';
import LevelLoader from '../world/LevelLoader.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // Only the manifests load here: PreloadScene needs them already cached before it
    // can know which audio/image/section files to queue.
    SoundManager.queueManifestLoad(this);
    ParallaxBackground.queueManifestLoad(this);
    PlatformTextures.queueManifestLoad(this);
    LevelLoader.queueManifestLoad(this);
  }

  create() {
    // The level sequence (just loaded above) only lists level ids: each level's own
    // definition (parallax/cellSize/sections) is a separate file, so it must be fetched
    // in its own load pass before PreloadScene can queue sections out of it.
    LevelLoader.queueLevelDefLoads(this);
    if (this.load.list.size === 0) {
      this.scene.start('PreloadScene');
      return;
    }
    this.load.once('complete', () => this.scene.start('PreloadScene'));
    this.load.start();
  }
}
