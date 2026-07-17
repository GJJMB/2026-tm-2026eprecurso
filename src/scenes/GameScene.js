import Stickman from '../entities/Stickman.js';
import FalseFriend from '../entities/FalseFriend.js';
import Crawler from '../entities/Crawler.js';
import VomitSeagull from '../entities/VomitSeagull.js';
import Checkpoint from '../entities/Checkpoint.js';
import SoundManager from '../audio/SoundManager.js';
import ParallaxBackground from '../world/ParallaxBackground.js';
import LevelLoader from '../world/LevelLoader.js';
import { ENTITY_TYPES, DEFAULT_ENEMY_RANGE_COLS, normalizeCellSpan } from '../world/levelFormat.js';
import { t } from '../i18n.js';
import { showPauseMenu, hidePauseMenu } from '../ui/DomMenus.js';

const GROUND_COLOR = 0x3a3a4a;
const PLATFORM_COLOR = 0x4a4a5e;
const MOVING_PLATFORM_COLOR = 0x4f7a5c;
const HAZARD_COLOR = 0xd1495b;
const GOAL_POLE_COLOR = 0xd8d8d8;
const GOAL_FLAG_COLOR = 0xffcc33;
const BACKGROUND_COLOR = 0x2e3a4a;
// Behind every interactable/foreground object (depth 0, Phaser's default) but in front of
// the parallax backdrop (see assets/images/parallax-sets.json, depths -20/-10).
const BACKGROUND_DEPTH = -5;

const DEFAULT_LEVEL_KEY = 'level1';
const DEFAULT_LIVES = 3;

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
    this.levelKey = levelKey;
    // A truthy campaignId means this level came from a user-authored, IndexedDB-stored
    // campaign (see MenuScene.js) rather than the built-in assets/levels/* sequence —
    // threaded through so LevelLoader reads/writes the right namespaced cache keys and
    // "Next Level" walks that campaign's own sequence instead of the built-in one.
    this.campaignId = (data && data.campaignId) || null;
    // Lives persist across level transitions via this same scene-start payload (see
    // _finish/GameOverScene) — a fresh run from the menu never passes `lives`, so it
    // defaults here; an explicit Restart deliberately omits it too, to reset to a full
    // set rather than carrying over a depleted count.
    this.lives = Number.isFinite(data && data.lives) ? data.lives : DEFAULT_LIVES;
    const plan = LevelLoader.build(this, levelKey, groundTopY, this.campaignId);
    const levelWidth = Math.max(plan.levelWidth, width);

    // Sections anchor their ground row to groundTopY (see rowToWorldY), so a section
    // taller than the viewport has rows whose world Y is negative — above y=0, not below
    // it. Bounds must reach at least that high, or the camera physically cannot scroll up
    // to it regardless of startFollow's vertical lerp below, and physics.world.setBounds
    // would otherwise treat that space as out of the world too. plan.levelHeight is the
    // tallest section's row-count-derived height, so this reaches every section's top row.
    const worldTop = Math.min(0, groundTopY - plan.levelHeight - plan.cellSize);
    // Extra headroom below the visible ground so falling into a pit is a real
    // fall (camera just won't follow that far down) rather than an instant stop
    // against the world bounds.
    const worldBottom = height + 400;
    this.physics.world.setBounds(0, worldTop, levelWidth, worldBottom - worldTop);
    this.cameras.main.setBounds(0, worldTop, levelWidth, worldBottom - worldTop);

    this.parallax = new ParallaxBackground(this, plan.parallax || levelKey);

    // Resolved (texture-or-color) look for a given tile/platform "id" — see _resolveAppearance.
    this._appearanceCache = new Map();

    this.platforms = [];
    this.movingPlatforms = [];
    this.hazards = [];
    this.enemies = [];
    this.finished = false;
    this.paused = false;
    this.elapsedMs = 0;
    this.deathY = height + 150;
    this.invulnerableUntil = 0;
    this.dying = false;

    let spawn = { x: 80, y: groundY - 80 };
    let goalPos = { x: levelWidth - 80, yTop: groundTopY };

    // Background layer — purely decorative "ground"-equivalent tiles (levelFormat.js's
    // CELL.BACKGROUND / a section's optional bgGrid), drawn behind every foreground object
    // with no physics body: nothing here ever collides with or blocks the player.
    for (const tile of plan.bgTiles) {
      const cx = tile.x + tile.w / 2;
      const cy = tile.y + tile.h / 2;
      const style = tile.style || {};
      const id = this._appearanceId('background', style);
      const appearance = this._resolveAppearance(id, style.texture, style.color, BACKGROUND_COLOR, style.tileMode);
      this._makeAppearanceObject(cx, cy, tile.w, tile.h, appearance).setDepth(BACKGROUND_DEPTH);
    }

    // Ground/hazard tiles are styled per-section (see levelFormat.js's docstring) via
    // that section's own optional tileStyles — LevelLoader already resolved each tile's
    // `style` (or null) and `kind` ('ground'/'hazard' — not necessarily implied by the
    // literal character once a section defines its own variants) from its owning section,
    // so no per-level lookup is needed here.
    for (const tile of plan.tiles) {
      const cx = tile.x + tile.w / 2;
      const cy = tile.y + tile.h / 2;
      const style = tile.style || {};
      if (tile.kind === 'hazard') {
        const id = this._appearanceId('hazard', style);
        const appearance = this._resolveAppearance(id, style.texture, style.color, HAZARD_COLOR, style.tileMode);
        this._addHazard(cx, cy, tile.w, tile.h, appearance);
      } else {
        // The ground baseline row and any elevated platform share the same style/texture,
        // but keep their own default fallback color when no style is set.
        const base = tile.isGroundRow ? 'ground-baseline' : 'ground-elevated';
        const fallback = tile.isGroundRow ? GROUND_COLOR : PLATFORM_COLOR;
        const id = this._appearanceId(base, style);
        const appearance = this._resolveAppearance(id, style.texture, style.color, fallback, style.tileMode);
        this._addPlatform(cx, cy, tile.w, tile.h, appearance);
      }
    }

    // Enemies/checkpoints to spawn once the player/platforms exist below, so their
    // colliders/overlaps can be wired up immediately instead of patched in afterwards.
    const enemySpawns = [];
    const checkpointSpawns = [];

    for (const entity of plan.entities) {
      if (entity.type === ENTITY_TYPES.PLAYER_SPAWN) {
        spawn = { x: entity.x, y: entity.y };
      } else if (entity.type === ENTITY_TYPES.GOAL) {
        goalPos = { x: entity.x, yTop: entity.yTop };
      } else if (entity.type === ENTITY_TYPES.MOVING_PLATFORM) {
        const w = normalizeCellSpan(entity.widthCells) * plan.cellSize;
        const h = normalizeCellSpan(entity.heightCells) * plan.cellSize;
        const id = this._appearanceId('movingPlatform', entity);
        const appearance = this._resolveAppearance(id, entity.texture, entity.color, MOVING_PLATFORM_COLOR, entity.tileMode);
        this._addMovingPlatform(entity.waypoints, w, h, appearance, entity.speeds);
      } else if (
        entity.type === ENTITY_TYPES.ENEMY_FALSE_FRIEND ||
        entity.type === ENTITY_TYPES.ENEMY_CRAWLER ||
        entity.type === ENTITY_TYPES.ENEMY_VOMIT_SEAGULL
      ) {
        enemySpawns.push(entity);
      } else if (entity.type === ENTITY_TYPES.CHECKPOINT) {
        checkpointSpawns.push(entity);
      }
    }

    this._addGoal(goalPos.x, goalPos.yTop);

    // ---- Sound ----
    this.sfx = new SoundManager(this);

    // The default respawn target when no checkpoint has been touched yet (or the level
    // defines none at all) is simply the level's own spawn point.
    this.currentCheckpoint = spawn;

    this.player = new Stickman(this, spawn.x, spawn.y);
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.overlap(this.player, this.hazards, () => this._loseLife(), undefined, this);
    this.physics.add.overlap(this.player, this.goal, () => this._finish(true), undefined, this);

    // ---- Enemies – placed by the level itself (see levelFormat.js's ENTITY_TYPES) ----
    for (const entity of enemySpawns) {
      this._addEnemy(entity, plan.cellSize);
    }

    // ---- Checkpoints – touching one moves the respawn point forward (see _respawnPlayer) ----
    this.checkpoints = [];
    for (const entity of checkpointSpawns) {
      const checkpoint = new Checkpoint(this, entity.x, entity.y);
      this.physics.add.overlap(
        this.player,
        checkpoint,
        () => {
          checkpoint.activate();
          this.currentCheckpoint = { x: checkpoint.x, y: checkpoint.y };
        },
        undefined,
        this
      );
      this.checkpoints.push(checkpoint);
    }

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

    this.livesLabel = t('game.lives');
    this.livesText = this.add
      .text(16, 40, `${this.livesLabel}: ${this.lives}`, { fontSize: '16px', color: '#ffffff' })
      .setScrollFactor(0)
      .setDepth(10);

    // Temporary "N lives left" banner shown while respawning (see _showCenterMessage) —
    // created once here, hidden (alpha 0) until a death actually triggers it.
    this.centerMessageText = this.add
      .text(width / 2, height / 2, '', { fontSize: '28px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(20)
      .setAlpha(0);
  }

  /**
   * Builds the enemy named by `entity.type` (see levelFormat.js's ENTITY_TYPES) at its
   * placed position, and wires up the same platform/player collisions every enemy needs.
   * Crawler/VomitSeagull patrol a bounded range around their spawn point, sized in cells
   * via the entity's optional `rangeCols` (falls back to DEFAULT_ENEMY_RANGE_COLS).
   */
  _addEnemy(entity, cellSize) {
    const rangePx = (entity.rangeCols || DEFAULT_ENEMY_RANGE_COLS) * cellSize;
    let enemy;
    if (entity.type === ENTITY_TYPES.ENEMY_FALSE_FRIEND) {
      enemy = new FalseFriend(this, entity.x, entity.y);
    } else if (entity.type === ENTITY_TYPES.ENEMY_CRAWLER) {
      enemy = new Crawler(this, entity.x, entity.y, entity.x - rangePx, entity.x + rangePx);
    } else if (entity.type === ENTITY_TYPES.ENEMY_VOMIT_SEAGULL) {
      enemy = new VomitSeagull(this, entity.x, entity.y, entity.x - rangePx, entity.x + rangePx);
    } else {
      return;
    }

    this.physics.add.collider(enemy, this.platforms);
    this.physics.add.collider(this.player, enemy);
    this.physics.add.overlap(this.player, enemy, this._handlePlayerEnemyCollision, undefined, this);
    this.enemies.push(enemy);
  }

  _handlePlayerEnemyCollision(player, enemy) {
    if (enemy.alive === false) return;
    if (this.time.now < this.invulnerableUntil) return; // just respawned, brief grace period
    // Only enemies that implement takeDamage/die (currently FalseFriend) can be stomped —
    // anything else is simply lethal to touch, from any side.
    const stompable = typeof enemy.takeDamage === 'function';
    const playerBottom = player.y;
    const enemyTop = enemy.y - 40;
    if (stompable && player.body.velocity.y > 0 && playerBottom < enemyTop + 10) {
      // Stomp → kill enemy
      enemy.takeDamage();
      player.body.setVelocityY(-300);
      this.sfx.play('jump');
    } else {
      this._loseLife();
    }
  }

  // ---- helpers ----

  /**
   * Builds a cache key for _resolveAppearance out of a `base` id (what kind of thing this
   * is — 'hazard', 'ground-baseline', a moving platform, ...) plus the actual override
   * values in `style`. Folding the override into the key (not just the base id) is what
   * keeps two sections with different tileStyles for the same character from bleeding
   * into each other's cached appearance, while identical styles across sections/tiles
   * still correctly share one resolved entry. `tileMode` is folded in too since it's part
   * of the same override (see levelFormat.js's tileMode docs).
   */
  _appearanceId(base, style) {
    return `${base}:${style.texture || ''}:${style.color || ''}:${style.tileMode || ''}`;
  }

  /**
   * Resolves (once per unique `id`) what to render a tile/platform as — a texture key
   * (`texture`, if it names a loaded image) or a fill color (`color`, a CSS hex string or
   * numeric 0xRRGGBB), falling back to `fallbackColor` when neither is given. Cached by
   * `id` so e.g. every ground tile in a level only resolves/parses its style once, not
   * once per tile instance. `tileMode` ('stretch'/'repeat'/'maximise', see
   * levelFormat.js) rides along unresolved — only _makeAppearanceObject needs it, and only
   * when a texture is actually in play.
   */
  _resolveAppearance(id, texture, color, fallbackColor, tileMode) {
    if (this._appearanceCache.has(id)) return this._appearanceCache.get(id);
    let resolved;
    if (texture && this.textures.exists(texture)) {
      resolved = { texture, tileMode };
    } else if (color) {
      resolved = { color: typeof color === 'string' ? Phaser.Display.Color.HexStringToColor(color).color : color };
    } else {
      resolved = { color: fallbackColor };
    }
    this._appearanceCache.set(id, resolved);
    return resolved;
  }

  /**
   * Builds a `w`x`h` game object at `x,y` per a resolved appearance. A flat-colored
   * Rectangle if there's no texture. Otherwise: a repeating TileSprite (sprite tiled at
   * its native size, no stretching) when `tileMode === 'repeat'`; a plain stretched-to-fit
   * Image for everything else — 'stretch' explicitly, and 'maximise' too, since
   * LevelLoader has already decomposed a 'maximise' tile into several near-square
   * rectangles by the time it gets here (see levelFormat.js's decomposeMaximizedRegions) —
   * each one just needs to fill its own w×h like any other stretched tile.
   */
  _makeAppearanceObject(x, y, w, h, appearance) {
    if (appearance.texture) {
      if (appearance.tileMode === 'repeat') {
        return this.add.tileSprite(x, y, w, h, appearance.texture);
      }
      const img = this.add.image(x, y, appearance.texture);
      img.setDisplaySize(w, h);
      return img;
    }
    return this.add.rectangle(x, y, w, h, appearance.color);
  }

  _addPlatform(x, y, w, h, appearance) {
    const rect = this._makeAppearanceObject(x, y, w, h, appearance);
    this.physics.add.existing(rect, true);
    this.platforms.push(rect);
    return rect;
  }

  /**
   * `waypoints` is a world-space {x,y}[] path (>=2 points); `speeds[i]` is the px/s used
   * while traversing the segment between waypoints[i] and waypoints[i+1]. The platform
   * ping-pongs along the path: forward to the last waypoint, then back to the first.
   */
  _addMovingPlatform(waypoints, w, h, appearance, speeds) {
    const start = waypoints[0];
    const rect = this._makeAppearanceObject(start.x, start.y, w, h, appearance);
    this.physics.add.existing(rect);
    rect.body.setAllowGravity(false);
    rect.body.setImmovable(true);
    // Constant Arcade velocity per segment (not a manually-set position) is what lets
    // collision separation carry a rider along for free; position is only snapped
    // exactly on waypoint arrival, to stop small per-frame overshoot from drifting.
    rect._patrol = { waypoints, speeds, segmentIndex: 0, direction: 1 };
    this._applyPatrolVelocity(rect);
    this.platforms.push(rect);
    this.movingPlatforms.push(rect);
    return rect;
  }

  _applyPatrolVelocity(platform) {
    const { waypoints, speeds, segmentIndex, direction } = platform._patrol;
    const from = direction === 1 ? waypoints[segmentIndex] : waypoints[segmentIndex + 1];
    const to = direction === 1 ? waypoints[segmentIndex + 1] : waypoints[segmentIndex];
    const speed = speeds[segmentIndex];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.hypot(dx, dy) || 1;
    platform.body.setVelocity((dx / dist) * speed, (dy / dist) * speed);
  }

  _addHazard(x, y, w, h, appearance) {
    const rect = this._makeAppearanceObject(x, y, w, h, appearance);
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

  // ---- lives / respawn ----

  /** Called on any death (hazard, pit-fall, lethal enemy touch) instead of finishing the
   * scene outright — decrements the life count, plays a brief death animation, and either
   * respawns in place afterward (lives left) or falls through to the real Game Over
   * (none left). `this.dying` guards re-entry while the animation is playing — a hazard
   * overlap, for instance, keeps firing every frame the (now motionless) player still
   * touches it. */
  _loseLife() {
    if (this.finished || this.dying || this.time.now < this.invulnerableUntil) return;
    this.lives--;
    this._updateLivesHud();
    if (this.lives <= 0) {
      this._playDeathAnimation(() => this._finish(false));
      return;
    }
    this._showCenterMessage(`${this.lives} ${t('game.livesLeft')}`);
    this._playDeathAnimation(() => this._respawnPlayer());
  }

  /** Freezes the player (no input, no gravity/velocity) and fades/spins/shrinks it out,
   * then hands off to `onComplete` once the tween finishes — either a respawn or the real
   * finish, depending on whether any lives remain (see _loseLife). update() skips
   * player.update() while `this.dying` is true so Stickman's own per-frame draw() (which
   * unconditionally re-applies scale/rotation from its pose) doesn't fight the tween. */
  _playDeathAnimation(onComplete) {
    this.dying = true;
    this.player.setMove(0);
    this.player.body.setVelocity(0, 0);
    this.player.body.setAllowGravity(false);
    this.tweens.add({
      targets: this.player,
      alpha: 0,
      angle: 180,
      scale: 0.3,
      duration: 450,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.player.setAlpha(1);
        this.player.setAngle(0);
        this.player.setScale(1);
        this.player.body.setAllowGravity(true);
        this.dying = false;
        onComplete();
      },
    });
  }

  _respawnPlayer() {
    const { x, y } = this.currentCheckpoint;
    this.player.respawn(x, y);
    // Snap instantly rather than letting startFollow's lerp slowly pan the camera all the
    // way back across the level to the checkpoint, which would look broken.
    this.cameras.main.centerOn(x, y);
    // Brief grace period so the overlap that just killed the player (or one right at the
    // checkpoint itself) can't immediately burn a second life the same/next frame.
    this.invulnerableUntil = this.time.now + 1000;
  }

  _updateLivesHud() {
    this.livesText.setText(`${this.livesLabel}: ${this.lives}`);
  }

  /** Shows `text` centered on screen, then fades it back out — used for the "N lives
   * left" banner. `killTweensOf` guards against overlapping banners if death somehow
   * happens again before the previous one finished fading. */
  _showCenterMessage(text) {
    this.tweens.killTweensOf(this.centerMessageText);
    this.centerMessageText.setText(text);
    this.centerMessageText.setAlpha(1);
    this.tweens.add({
      targets: this.centerMessageText,
      alpha: 0,
      delay: 900,
      duration: 400,
      ease: 'Cubic.easeOut',
    });
  }

  _finish(won) {
    if (this.finished) return;
    this.finished = true;
    this.player.setMove(0);
    this.sfx.play(won ? 'win' : 'lose');
    const nextLevel = won ? LevelLoader.getNextLevelKey(this, this.levelKey, this.campaignId) : null;
    this.scene.start('GameOverScene', { won, level: this.levelKey, nextLevel, campaignId: this.campaignId, lives: this.lives });
  }

  // ---- update ----
  update(time, delta) {
    if (this.finished || this.paused) return;

    this.parallax.update(this.cameras.main.scrollX);

    // moving platforms
    for (const platform of this.movingPlatforms) {
      const patrol = platform._patrol;
      const targetIdx = patrol.direction === 1 ? patrol.segmentIndex + 1 : patrol.segmentIndex;
      const target = patrol.waypoints[targetIdx];
      // Dot product of "vector to target" and current velocity flips sign exactly when
      // the platform reaches/passes the target, regardless of speed or frame timing —
      // more robust than a fixed distance epsilon at variable delta.
      const dot = (target.x - platform.x) * platform.body.velocity.x + (target.y - platform.y) * platform.body.velocity.y;
      if (dot <= 0) {
        platform.body.reset(target.x, target.y);
        if (patrol.direction === 1) {
          if (patrol.segmentIndex >= patrol.waypoints.length - 2) patrol.direction = -1;
          else patrol.segmentIndex += 1;
        } else if (patrol.segmentIndex <= 0) {
          patrol.direction = 1;
        } else {
          patrol.segmentIndex -= 1;
        }
        this._applyPatrolVelocity(platform);
      }
    }

    // player — skipped while a death animation is playing (see _playDeathAnimation), so
    // Stickman's own draw() doesn't overwrite the tween's scale/rotation every frame.
    if (!this.dying) {
      const left = this.cursors.left.isDown || this.keys.A.isDown;
      const right = this.cursors.right.isDown || this.keys.D.isDown;
      const jump = Phaser.Input.Keyboard.JustDown(this.cursors.up) || Phaser.Input.Keyboard.JustDown(this.keys.SPACE);
      let dir = 0;
      if (left && !right) dir = -1;
      else if (right && !left) dir = 1;

      this.player.setMove(dir);
      if (jump && this.player.jump()) this.sfx.play('jump');
      this.player.update(time, delta);
    }

    // enemies
    for (const enemy of this.enemies) {
      if (enemy.alive !== false) enemy.update(time, delta, this.player);
    }

    // death
    if (!this.dying && this.player.y > this.deathY) {
      this._loseLife();
      return;
    }

    // HUD
    this.elapsedMs += delta;
    this.hudText.setText(`${this.hudLabel}: ${(this.elapsedMs / 1000).toFixed(1)}s`);
  }
}