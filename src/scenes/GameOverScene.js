import { showGameOverMenu, hideGameOverMenu } from '../ui/DomMenus.js';

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  init(data) {
    this.won = Boolean(data && data.won);
    this.level = data && data.level;
    this.nextLevel = data && data.nextLevel;
    this.campaignId = (data && data.campaignId) || null;
    this.lives = data && data.lives;
  }

  create() {
    const restart = () => {
      hideGameOverMenu();
      // `lives` deliberately omitted: Restart always starts the level fresh with a full
      // set (see GameScene's default), unlike Next Level below which carries the current
      // count forward.
      this.scene.start('GameScene', { level: this.level, campaignId: this.campaignId });
    };
    const goToNextLevel = this.nextLevel
      ? () => {
          hideGameOverMenu();
          this.scene.start('GameScene', { level: this.nextLevel, campaignId: this.campaignId, lives: this.lives });
        }
      : null;

    showGameOverMenu({ won: this.won, onRestart: restart, onNext: goToNextLevel });
    this.input.keyboard.once('keydown-R', restart);
    this.events.once('shutdown', hideGameOverMenu);
  }
}
