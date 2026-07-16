export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // Assets needed for the preload progress bar itself would load here.
  }

  create() {
    this.scene.start('PreloadScene');
  }
}
