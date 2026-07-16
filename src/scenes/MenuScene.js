import { showMainMenu, hideMainMenu } from '../ui/DomMenus.js';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    const start = () => this.scene.start('GameScene');

    showMainMenu({ onStart: start });

    this.input.keyboard.once('keydown-SPACE', () => {
      hideMainMenu();
      start();
    });

    this.events.once('shutdown', hideMainMenu);
  }
}
