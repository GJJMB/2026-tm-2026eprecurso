const DEBUG_ENEMY_COLOR = 0xff0000;
const DEBUG_PLAYER_COLOR = 0x00ff00;
const DEBUG_OTHER_COLOR = 0xffa500;
const DEBUG_LINE_WIDTH = 2;

/**
 * Base class for every physics-driven, hand-drawn game object (the player and all
 * enemies): wires up the Container + Arcade body + Graphics boilerplate every one of
 * them repeated, so subclasses only need to configure their body and implement
 * draw()/update() for their own specific behavior.
 */
export default class Actor extends Phaser.GameObjects.Container {
  constructor(scene, x, y) {
    super(scene, x, y);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.gfx = scene.add.graphics();
    this.add(this.gfx);

    // Debug hitbox overlay: drawn in world space via its own Graphics (not a container
    // child), so a subclass's own visual transform (e.g. Stickman.draw's lean/squash
    // scale+rotation) never distorts the box. Hooked to the scene's 'update' event
    // directly rather than this.update(), since every subclass overrides update()/draw()
    // without calling super, so there's no reliable per-actor hook to piggyback on.
    this._debugGfx = scene.add.graphics().setDepth(1000);
    this._onSceneUpdate = () => this._drawDebugHitbox();
    scene.events.on('update', this._onSceneUpdate);
    this.once('destroy', () => {
      scene.events.off('update', this._onSceneUpdate);
      this._debugGfx.destroy();
    });
  }

  /** Subclasses redraw `this.gfx` here to reflect their current state. */
  draw() {}

  /** Subclasses advance their per-frame state/animation here. */
  update() {}

  /**
   * When the owning scene has `debug = true`, outlines this actor's Arcade body with a
   * colored square: green for the player, red for enemies, orange for everything else
   * (checkpoints, etc). Which bucket an actor falls into is read off the scene's own
   * `player`/`enemies` bookkeeping (see GameScene) rather than the actor's class, since
   * this base class can't import its own subclasses without a circular dependency.
   */
  _drawDebugHitbox() {
    const g = this._debugGfx;
    g.clear();
    if (!this.scene || !this.scene.debug || !this.body) return;

    let color = DEBUG_OTHER_COLOR;
    if (this.scene.player === this) color = DEBUG_PLAYER_COLOR;
    else if (this.scene.enemies && this.scene.enemies.includes(this)) color = DEBUG_ENEMY_COLOR;

    g.lineStyle(DEBUG_LINE_WIDTH, color, 1);
    g.strokeRect(this.body.x, this.body.y, this.body.width, this.body.height);
  }
}
