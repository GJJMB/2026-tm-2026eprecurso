export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  init(data) {
    this.won = Boolean(data && data.won);
  }

  create() {
    const { width, height } = this.cameras.main;

    this.add
      .text(width / 2, height / 2 - 40, this.won ? 'You Win!' : 'Game Over', {
        fontSize: '36px',
        color: this.won ? '#7CFC00' : '#ff5555',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 20, 'Press R to restart', { fontSize: '18px', color: '#cccccc' })
      .setOrigin(0.5);

    // TODO (Phase 3): replace hardcoded strings with i18n lookups.

    this.input.keyboard.once('keydown-R', () => this.scene.start('GameScene'));
  }
}
