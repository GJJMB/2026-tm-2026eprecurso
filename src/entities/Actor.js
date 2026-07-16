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
  }

  /** Subclasses redraw `this.gfx` here to reflect their current state. */
  draw() {}

  /** Subclasses advance their per-frame state/animation here. */
  update() {}
}
