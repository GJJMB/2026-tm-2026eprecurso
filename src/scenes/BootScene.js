import SoundManager from '../audio/SoundManager.js';
import ParallaxBackground from '../world/ParallaxBackground.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // Only the manifests load here — PreloadScene needs them already cached before it
    // can know which audio/image files to queue.
    SoundManager.queueManifestLoad(this);
    ParallaxBackground.queueManifestLoad(this);
  }

  create() {
    this.scene.start('PreloadScene');
  }
}
