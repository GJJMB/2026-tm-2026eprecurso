import Stickman from '../entities/Stickman.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    const width = this.scale.width;
    const height = this.scale.height;
    const levelWidth = Math.max(width * 3, 2400);

    this.physics.world.setBounds(0, 0, levelWidth, height);
    this.cameras.main.setBounds(0, 0, levelWidth, height);

    this.platforms = [];

    const groundY = height - 24;
    this._addPlatform(levelWidth / 2, groundY, levelWidth, 48, 0x3a3a4a);
    this._addPlatform(420, groundY - 120, 160, 24, 0x4a4a5e);
    this._addPlatform(720, groundY - 200, 160, 24, 0x4a4a5e);
    this._addPlatform(1040, groundY - 120, 160, 24, 0x4a4a5e);
    this._addPlatform(1400, groundY - 240, 200, 24, 0x4a4a5e);

    this.player = new Stickman(this, 80, groundY - 80);
    this.physics.add.collider(this.player, this.platforms);

    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setDeadzone(120, 80);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('A,D,SPACE');

    this.add
      .text(width / 2, 16, 'Arrows / A-D to move, Up or Space to jump', {
        fontSize: '14px',
        color: '#888888',
      })
      .setScrollFactor(0)
      .setOrigin(0.5, 0)
      .setDepth(10);

    // TODO (Phase 2): hazards, goal object, HUD, real win/lose triggers via overlap.
    this.input.keyboard.once('keydown-W', () => this.scene.start('GameOverScene', { won: true }));
    this.input.keyboard.once('keydown-L', () => this.scene.start('GameOverScene', { won: false }));
  }

  _addPlatform(x, y, w, h, color) {
    const rect = this.add.rectangle(x, y, w, h, color);
    this.physics.add.existing(rect, true);
    this.platforms.push(rect);
    return rect;
  }

  update(time, delta) {
    const left = this.cursors.left.isDown || this.keys.A.isDown;
    const right = this.cursors.right.isDown || this.keys.D.isDown;
    const jumpPressed =
      Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.keys.SPACE);

    let dir = 0;
    if (left && !right) dir = -1;
    else if (right && !left) dir = 1;

    this.player.setMove(dir);
    if (jumpPressed) this.player.jump();

    this.player.update(time, delta);
  }
}
