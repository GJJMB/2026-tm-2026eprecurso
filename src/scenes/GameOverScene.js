import { showGameOverMenu, hideGameOverMenu } from '../ui/DomMenus.js';

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  init(data) {
    this.won = Boolean(data && data.won);
  }

  create() {
    const restart = () => {
      hideGameOverMenu();
      this.scene.start('GameScene');
    };

    showGameOverMenu({ won: this.won, onRestart: restart });
    this.input.keyboard.once('keydown-R', restart);
    this.events.once('shutdown', hideGameOverMenu);
  }
}
