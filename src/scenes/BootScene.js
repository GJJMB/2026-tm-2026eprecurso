import SoundManager from '../audio/SoundManager.js';
import ParallaxBackground from '../world/ParallaxBackground.js';
import LevelLoader from '../world/LevelLoader.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // Only the manifests load here — PreloadScene needs them already cached before it
    // can know which audio/image/section files to queue.
    SoundManager.queueManifestLoad(this);
    ParallaxBackground.queueManifestLoad(this);
    LevelLoader.queueManifestLoad(this);
  }

  create() {
    this.scene.start('PreloadScene');
  }
}
