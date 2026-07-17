import Actor from './Actor.js';

const POLE_COLOR = 0xd8d8d8;
const INACTIVE_FLAG_COLOR = 0x888888;
const ACTIVE_FLAG_COLOR = 0x7cfc9a;
const POLE_HEIGHT = 50;

/**
 * A flag the player can touch to move their respawn point forward (see
 * GameScene._loseLife/_respawnPlayer) — a static trigger, not an AI actor. Shorter than
 * the goal's pole (GameScene._addGoal, 70px) and a different flag color so the two are
 * never confused at a glance; the flag switches from gray to green the moment it's
 * activated and stays that way for the rest of the level attempt.
 */
export default class Checkpoint extends Actor {
  constructor(scene, x, y) {
    super(scene, x, y);

    this.body.setSize(30, POLE_HEIGHT);
    this.body.setOffset(-15, -POLE_HEIGHT);
    this.body.setAllowGravity(false);
    this.body.setImmovable(true);

    this.activated = false;

    this.draw();
  }

  /** Idempotent, mirroring FalseFriend's takeDamage/die guard — an overlap fires every
   * frame the player stands on the checkpoint, not just once. */
  activate() {
    if (this.activated) return;
    this.activated = true;
    this.draw();
  }

  draw() {
    const g = this.gfx;
    g.clear();
    g.lineStyle(4, POLE_COLOR, 1);
    g.lineBetween(0, 0, 0, -POLE_HEIGHT);
    g.fillStyle(this.activated ? ACTIVE_FLAG_COLOR : INACTIVE_FLAG_COLOR, 1);
    g.fillTriangle(0, -POLE_HEIGHT, 18, -POLE_HEIGHT + 7, 0, -POLE_HEIGHT + 14);
  }
}
