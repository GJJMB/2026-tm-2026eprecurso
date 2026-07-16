import Stickman from '../entities/Stickman.js';
import SoundManager from '../audio/SoundManager.js';
import ParallaxBackground from '../world/ParallaxBackground.js';
import { t } from '../i18n.js';
import { showPauseMenu, hidePauseMenu } from '../ui/DomMenus.js';

const GROUND_COLOR = 0x3a3a4a;
const PLATFORM_COLOR = 0x4a4a5e;
const MOVING_PLATFORM_COLOR = 0x4f7a5c;
const HAZARD_COLOR = 0xd1495b;
const GOAL_POLE_COLOR = 0xd8d8d8;
const GOAL_FLAG_COLOR = 0xffcc33;

const PIT_START = 900;
const PIT_WIDTH = 150;

const DEFAULT_LEVEL_KEY = 'level1';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create(data) {
    const width = this.scale.width;
    const height = this.scale.height;
    const levelWidth = Math.max(width * 4, 3000);
    const groundY = height - 24;
    const groundTopY = groundY - 24;

    // Extra headroom below the visible ground so falling into the pit is a real
    // fall (camera just won't follow that far down) rather than an instant stop
    // against the world bounds.
    this.physics.world.setBounds(0, 0, levelWidth, height + 400);
    this.cameras.main.setBounds(0, 0, levelWidth, height);

    // Layer set is picked by key (see assets/images/parallax-sets.json) so a future
    // level-select flow can pass e.g. `this.scene.start('GameScene', { level: 'level2' })`
    // without any change here.
    this.parallax = new ParallaxBackground(this, (data && data.level) || DEFAULT_LEVEL_KEY);

    this.platforms = [];
    this.movingPlatforms = [];
    this.hazards = [];
    this.finished = false;
    this.paused = false;
    this.elapsedMs = 0;
    this.deathY = height + 150;

    const pitEnd = PIT_START + PIT_WIDTH;
    this._addPlatform(PIT_START / 2, groundY, PIT_START, 48, GROUND_COLOR);
    this._addPlatform(pitEnd + (levelWidth - pitEnd) / 2, groundY, levelWidth - pitEnd, 48, GROUND_COLOR);

    this._addPlatform(420, groundY - 120, 160, 24, PLATFORM_COLOR);
    this._addPlatform(720, groundY - 200, 160, 24, PLATFORM_COLOR);
    this._addPlatform(1040, groundY - 120, 160, 24, PLATFORM_COLOR);

    this._addMovingPlatform(1700, groundY - 160, 140, 24, MOVING_PLATFORM_COLOR, {
      axis: 'y',
      range: 80,
      speed: 70,
    });

    this._addHazard(1300, groundTopY - 10, 60, 20, HAZARD_COLOR);

    this._addGoal(levelWidth - 80, groundTopY);

    this.sfx = new SoundManager(this);

    this.player = new Stickman(this, 80, groundY - 80);
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.overlap(this.player, this.hazards, () => this._finish(false), undefined, this);
    this.physics.add.overlap(this.player, this.goal, () => this._finish(true), undefined, this);

    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setDeadzone(120, 80);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('A,D,SPACE');
    this.input.keyboard.on('keydown-ESC', () => this._togglePause());
    this.events.once('shutdown', hidePauseMenu);

    this.add
      .text(width / 2, 16, t('game.instructions'), {
        fontSize: '14px',
        color: '#888888',
      })
      .setScrollFactor(0)
      .setOrigin(0.5, 0)
      .setDepth(10);

    this.hudLabel = t('game.time');
    this.hudText = this.add
      .text(16, 16, `${this.hudLabel}: 0.0s`, { fontSize: '16px', color: '#ffffff' })
      .setScrollFactor(0)
      .setDepth(10);
  }

  _addPlatform(x, y, w, h, color) {
    const rect = this.add.rectangle(x, y, w, h, color);
    this.physics.add.existing(rect, true);
    this.platforms.push(rect);
    return rect;
  }

  _addMovingPlatform(x, y, w, h, color, { axis, range, speed }) {
    const rect = this.add.rectangle(x, y, w, h, color);
    this.physics.add.existing(rect);
    rect.body.setAllowGravity(false);
    rect.body.setImmovable(true);
    rect.body.velocity[axis] = speed;
    // Simple patrol: real Arcade velocity (not a manually-set position) is what lets
    // collision separation carry a rider along with the platform for free.
    rect._patrol = { axis, origin: axis === 'x' ? x : y, range, speed };
    this.platforms.push(rect);
    this.movingPlatforms.push(rect);
    return rect;
  }

  _addHazard(x, y, w, h, color) {
    const rect = this.add.rectangle(x, y, w, h, color);
    this.physics.add.existing(rect, true);
    this.hazards.push(rect);
    return rect;
  }

  _addGoal(x, groundTopY) {
    const poleHeight = 70;
    const container = this.add.container(x, groundTopY);

    const pole = this.add.rectangle(0, -poleHeight / 2, 4, poleHeight, GOAL_POLE_COLOR);
    const flag = this.add.triangle(0, -poleHeight + 16, 0, -12, 24, -4, 0, 4, GOAL_FLAG_COLOR);
    container.add([pole, flag]);

    this.physics.add.existing(container);
    container.body.setAllowGravity(false);
    container.body.setImmovable(true);
    container.body.setSize(30, poleHeight);
    container.body.setOffset(-15, -poleHeight);

    this.goal = container;
    return container;
  }

  _togglePause() {
    if (this.finished) return;
    if (this.paused) this._resume();
    else this._pause();
  }

  _pause() {
    // Freeze physics instead of this.scene.pause(): a full scene pause also
    // suspends this scene's own Input Plugin, which would stop the keydown-ESC
    // listener below from ever firing again to close the menu.
    this.paused = true;
    this.physics.pause();
    showPauseMenu({
      onResume: () => this._resume(),
      onRestart: () => this.scene.start('GameScene'),
      onLeave: () => this.scene.start('MenuScene'),
    });
  }

  _resume() {
    this.paused = false;
    this.physics.resume();
    hidePauseMenu();
    // Drop any key state latched while paused so it can't fire an action (e.g. a jump) on resume.
    this.input.keyboard.resetKeys();
  }

  _finish(won) {
    if (this.finished) return;
    this.finished = true;
    this.player.setMove(0);
    this.sfx.play(won ? 'win' : 'lose');
    this.scene.start('GameOverScene', { won });
  }

  update(time, delta) {
    if (this.finished || this.paused) return;

    this.parallax.update(this.cameras.main.scrollX);

    for (const platform of this.movingPlatforms) {
      const { axis, origin, range, speed } = platform._patrol;
      const pos = platform[axis];
      if (pos > origin + range) platform.body.velocity[axis] = -Math.abs(speed);
      else if (pos < origin - range) platform.body.velocity[axis] = Math.abs(speed);
    }

    const left = this.cursors.left.isDown || this.keys.A.isDown;
    const right = this.cursors.right.isDown || this.keys.D.isDown;
    const jumpPressed =
      Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.keys.SPACE);

    let dir = 0;
    if (left && !right) dir = -1;
    else if (right && !left) dir = 1;

    this.player.setMove(dir);
    if (jumpPressed && this.player.jump()) this.sfx.play('jump');
    this.player.update(time, delta);

    if (this.player.y > this.deathY) {
      this._finish(false);
      return;
    }

    this.elapsedMs += delta;
    this.hudText.setText(`${this.hudLabel}: ${(this.elapsedMs / 1000).toFixed(1)}s`);
  }
}
