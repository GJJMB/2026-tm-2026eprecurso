import SoundManager from '../audio/SoundManager.js';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // Only the sound-events manifest loads here — PreloadScene needs it already
    // cached before it can know which audio files to queue.
    SoundManager.queueManifestLoad(this);
  }

  create() {
    this.scene.start('PreloadScene');
  }
}
