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
  }

  create() {
    const restart = () => {
      hideGameOverMenu();
      this.scene.start('GameScene', { level: this.level, campaignId: this.campaignId });
    };
    const goToNextLevel = this.nextLevel
      ? () => {
          hideGameOverMenu();
          this.scene.start('GameScene', { level: this.nextLevel, campaignId: this.campaignId });
        }
      : null;

    showGameOverMenu({ won: this.won, onRestart: restart, onNext: goToNextLevel });
    this.input.keyboard.once('keydown-R', restart);
    this.events.once('shutdown', hideGameOverMenu);
  }
}
