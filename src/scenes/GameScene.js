import Stickman from '../entities/Stickman.js';
import SoundManager from '../audio/SoundManager.js';
import ParallaxBackground from '../world/ParallaxBackground.js';
import LevelLoader from '../world/LevelLoader.js';
import { CELL, ENTITY_TYPES } from '../world/levelFormat.js';
import { t } from '../i18n.js';
import { showPauseMenu, hidePauseMenu } from '../ui/DomMenus.js';

const GROUND_COLOR = 0x3a3a4a;
const PLATFORM_COLOR = 0x4a4a5e;
const MOVING_PLATFORM_COLOR = 0x4f7a5c;
const HAZARD_COLOR = 0xd1495b;
const GOAL_POLE_COLOR = 0xd8d8d8;
const GOAL_FLAG_COLOR = 0xffcc33;

const DEFAULT_LEVEL_KEY = 'level1';
const DEFAULT_MOVING_PLATFORM_WIDTH_CELLS = 3;
const DEFAULT_MOVING_PLATFORM_RANGE = 80;
const DEFAULT_MOVING_PLATFORM_SPEED = 70;

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create(data) {
    const width = this.scale.width;
    const height = this.scale.height;
    const groundY = height - 24;
    const groundTopY = groundY - 24;

    // Level is picked by key (see assets/levels/levels.json) so a future level-select
    // flow can pass e.g. `this.scene.start('GameScene', { level: 'level2' })` without
    // any change here. LevelLoader strings the level's pre-made sections together into
    // world-space tiles/entities, anchored so every section's ground row lands on
    // groundTopY regardless of screen height.
    const levelKey = (data && data.level) || DEFAULT_LEVEL_KEY;
    const plan = LevelLoader.build(this, levelKey, groundTopY);
    const levelWidth = Math.max(plan.levelWidth, width);

    // Extra headroom below the visible ground so falling into a pit is a real
    // fall (camera just won't follow that far down) rather than an instant stop
    // against the world bounds.
    this.physics.world.setBounds(0, 0, levelWidth, height + 400);
    this.cameras.main.setBounds(0, 0, levelWidth, height);

    this.parallax = new ParallaxBackground(this, plan.parallax || levelKey);

    this.platforms = [];
    this.movingPlatforms = [];
    this.hazards = [];
    this.finished = false;
    this.paused = false;
    this.elapsedMs = 0;
    this.deathY = height + 150;

    let spawn = { x: 80, y: groundY - 80 };
    let goalPos = { x: levelWidth - 80, yTop: groundTopY };

    for (const tile of plan.tiles) {
      const cx = tile.x + tile.w / 2;
      const cy = tile.y + tile.h / 2;
      if (tile.type === CELL.HAZARD) {
        this._addHazard(cx, cy, tile.w, tile.h, HAZARD_COLOR);
      } else {
        this._addPlatform(cx, cy, tile.w, tile.h, tile.isGroundRow ? GROUND_COLOR : PLATFORM_COLOR);
      }
    }

    for (const entity of plan.entities) {
      if (entity.type === ENTITY_TYPES.PLAYER_SPAWN) {
        spawn = { x: entity.x, y: entity.y };
      } else if (entity.type === ENTITY_TYPES.GOAL) {
        goalPos = { x: entity.x, yTop: entity.yTop };
      } else if (entity.type === ENTITY_TYPES.MOVING_PLATFORM) {
        const w = (entity.widthCells || DEFAULT_MOVING_PLATFORM_WIDTH_CELLS) * plan.cellSize;
        this._addMovingPlatform(entity.x, entity.y, w, plan.cellSize, MOVING_PLATFORM_COLOR, {
          axis: entity.axis || 'y',
          range: entity.range || DEFAULT_MOVING_PLATFORM_RANGE,
          speed: entity.speed || DEFAULT_MOVING_PLATFORM_SPEED,
        });
      }
    }

    this._addGoal(goalPos.x, goalPos.yTop);

    this.sfx = new SoundManager(this);

    this.player = new Stickman(this, spawn.x, spawn.y);
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
