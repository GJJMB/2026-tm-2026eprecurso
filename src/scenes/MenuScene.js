export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    const { width, height } = this.cameras.main;

    this.add
      .text(width / 2, height / 2 - 40, 'Stickman Runner', { fontSize: '40px', color: '#ffffff' })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 20, 'Press SPACE to start', { fontSize: '20px', color: '#cccccc' })
      .setOrigin(0.5);

    // TODO (Phase 3): replace hardcoded strings with i18n lookups + language selector.

    this.input.keyboard.once('keydown-SPACE', () => this.scene.start('GameScene'));
    this.input.once('pointerdown', () => this.scene.start('GameScene'));
  }
}
