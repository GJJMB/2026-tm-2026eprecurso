// ===== src/scenes/GameScene.js =====
import Stickman from '../entities/Stickman.js';
import FalseFriend from '../entities/FalseFriend.js';
import SoundManager from '../audio/SoundManager.js';
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

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    const width = this.scale.width;
    const height = this.scale.height;
    const levelWidth = Math.max(width * 4, 3000);
    const groundY = height - 24;
    const groundTopY = groundY - 24;

    this.physics.world.setBounds(0, 0, levelWidth, height + 400);
    this.cameras.main.setBounds(0, 0, levelWidth, height);

    this.platforms = [];
    this.movingPlatforms = [];
    this.hazards = [];
    this.finished = false;
    this.paused = false;
    this.elapsedMs = 0;
    this.deathY = height + 150;

    // ---- Ground & platforms ----
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

    // ---- Sound ----
    this.sfx = new SoundManager(this);

    // ---- Player ----
    this.player = new Stickman(this, 80, groundY - 80);
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.overlap(this.player, this.hazards, () => this._finish(false), undefined, this);
    this.physics.add.overlap(this.player, this.goal, () => this._finish(true), undefined, this);

    // ---- FalseFriend – random spawn ----
    let spawnX;
    const minSpawn = 200, maxSpawn = levelWidth - 200;
    do {
      spawnX = minSpawn + Math.random() * (maxSpawn - minSpawn);
    } while (Math.abs(spawnX - 80) < 150);
    this.falseFriend = new FalseFriend(this, spawnX, groundY - 40);
    this.physics.add.collider(this.falseFriend, this.platforms);
    this.physics.add.collider(this.player, this.falseFriend);
    this.physics.add.overlap(this.player, this.falseFriend, this._handlePlayerEnemyCollision, undefined, this);

    // ---- Camera & controls ----
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setDeadzone(120, 80);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('A,D,SPACE');
    this.input.keyboard.on('keydown-ESC', () => this._togglePause());
    this.events.once('shutdown', hidePauseMenu);

    // ---- HUD ----
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

  _handlePlayerEnemyCollision(player, enemy) {
    if (!enemy.alive) return;
    const playerBottom = player.y;
    const enemyTop = enemy.y - 40;
    if (player.body.velocity.y > 0 && playerBottom < enemyTop + 10) {
      // Stomp → kill enemy
      enemy.takeDamage();
      player.body.setVelocityY(-300);
      this.sfx.play('jump');
    } else {
      this._finish(false);
    }
  }

  // ---- helpers ----
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

  // ---- pause ----
  _togglePause() {
    if (this.finished) return;
    if (this.paused) this._resume();
    else this._pause();
  }

  _pause() {
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
    this.input.keyboard.resetKeys();
  }

  _finish(won) {
    if (this.finished) return;
    this.finished = true;
    this.player.setMove(0);
    this.sfx.play(won ? 'win' : 'lose');
    this.scene.start('GameOverScene', { won });
  }

  // ---- update ----
  update(time, delta) {
    if (this.finished || this.paused) return;

    // moving platforms
    for (const platform of this.movingPlatforms) {
      const { axis, origin, range, speed } = platform._patrol;
      const pos = platform[axis];
      if (pos > origin + range) platform.body.velocity[axis] = -Math.abs(speed);
      else if (pos < origin - range) platform.body.velocity[axis] = Math.abs(speed);
    }

    // player
    const left = this.cursors.left.isDown || this.keys.A.isDown;
    const right = this.cursors.right.isDown || this.keys.D.isDown;
    const jump = Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.keys.SPACE);
    let dir = 0;
    if (left && !right) dir = -1;
    else if (right && !left) dir = 1;

    this.player.setMove(dir);
    if (jump && this.player.jump()) this.sfx.play('jump');
    this.player.update(time, delta);

    // enemy
    if (this.falseFriend.alive) {
      this.falseFriend.update(time, delta, this.player);
    }

    // death
    if (this.player.y > this.deathY) {
      this._finish(false);
      return;
    }

    // HUD
    this.elapsedMs += delta;
    this.hudText.setText(`${this.hudLabel}: ${(this.elapsedMs / 1000).toFixed(1)}s`);
  }
}