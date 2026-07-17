import { showGameOverMenu, hideGameOverMenu } from '../ui/DomMenus.js';

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  init(data) {
    this.won = Boolean(data && data.won);
    this.reason = data && data.reason;
    this.level = data && data.level;
    this.nextLevel = data && data.nextLevel;
    this.campaignId = (data && data.campaignId) || null;
    this.lives = data && data.lives;
    this.score = data && data.score;
    this.elapsedSeconds = data && data.elapsedSeconds;
    this.medal = data && data.medal;
  }

  create() {
    const restart = () => {
      hideGameOverMenu();
      // `lives`/`score` deliberately omitted: Restart always starts the level fresh with a
      // full set (see GameScene's defaults), unlike Next Level below which carries the
      // current count forward.
      this.scene.start('GameScene', { level: this.level, campaignId: this.campaignId });
    };
    const goToNextLevel = this.nextLevel
      ? () => {
          hideGameOverMenu();
          this.scene.start('GameScene', { level: this.nextLevel, campaignId: this.campaignId, lives: this.lives, score: this.score });
        }
      : null;
    const leave = () => {
      hideGameOverMenu();
      this.scene.start('MenuScene');
    };

    showGameOverMenu({
      won: this.won,
      reason: this.reason,
      score: this.score,
      medal: this.medal,
      onRestart: restart,
      onNext: goToNextLevel,
      onLeave: leave,
    });
    this.input.keyboard.once('keydown-R', restart);
    this.events.once('shutdown', hideGameOverMenu);
  }
}
