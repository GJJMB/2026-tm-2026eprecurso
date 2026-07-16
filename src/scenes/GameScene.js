export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    const { width, height } = this.cameras.main;

    this.add
      .text(width / 2, height / 2, 'GameScene (TODO: platforming)', { fontSize: '20px', color: '#ffffff' })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 30, 'Press W to simulate win, L to simulate lose', {
        fontSize: '14px',
        color: '#888888',
      })
      .setOrigin(0.5);

    // TODO (Phase 1): stickman sprite with Arcade physics, platform group, camera follow.
    // TODO (Phase 2): hazards, goal object, HUD, real win/lose triggers via overlap.

    this.input.keyboard.once('keydown-W', () => this.scene.start('GameOverScene', { won: true }));
    this.input.keyboard.once('keydown-L', () => this.scene.start('GameOverScene', { won: false }));
  }
}
