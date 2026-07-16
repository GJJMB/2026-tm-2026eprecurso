import { t } from '../i18n.js';

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
      .text(width / 2, height / 2 - 40, this.won ? t('gameover.win') : t('gameover.lose'), {
        fontSize: '36px',
        color: this.won ? '#7CFC00' : '#ff5555',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 20, t('gameover.restart'), { fontSize: '18px', color: '#cccccc' })
      .setOrigin(0.5);

    this.input.keyboard.once('keydown-R', () => this.scene.start('GameScene'));
  }
}
