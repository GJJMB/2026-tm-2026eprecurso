export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload() {
    const { width, height } = this.cameras.main;

    const loadingText = this.add
      .text(width / 2, height / 2, 'Loading...', { fontSize: '24px', color: '#ffffff' })
      .setOrigin(0.5);

    this.load.on('complete', () => loadingText.destroy());

    // TODO (Phase 1+): load stickman spritesheet, platform tiles, goal flag, audio.
  }

  create() {
    this.scene.start('MenuScene');
  }
}
