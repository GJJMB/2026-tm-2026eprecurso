import Actor from './Actor.js';

export default class Crawler extends Actor {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x - spawn x
   * @param {number} y - spawn y (should be on ground level)
   * @param {number} leftBound - left edge of patrol (optional)
   * @param {number} rightBound - right edge of patrol (optional)
   */
  constructor(scene, x, y, leftBound, rightBound) {
    super(scene, x, y);

    this.body.setSize(20, 20);
    this.body.setOffset(-10, -10);
    this.body.setCollideWorldBounds(true);
    this.body.setAllowGravity(false);  // we'll keep it on the ground via fixed y

    // Movement
    this.speed = 80;
    this.direction = 1; // 1 = right, -1 = left
    this.body.setVelocityX(this.direction * this.speed);

    // Patrol bounds (if not given, use world bounds or a default range)
    this.leftBound = leftBound || x - 150;
    this.rightBound = rightBound || x + 150;

    this.draw();
  }

  update() {
    // Reverse if out of bounds
    if (this.x > this.rightBound) {
      this.direction = -1;
      this.body.setVelocityX(this.direction * this.speed);
    } else if (this.x < this.leftBound) {
      this.direction = 1;
      this.body.setVelocityX(this.direction * this.speed);
    }
    // Keep it on a fixed y (optional – if you want it to follow ground, you'd need raycasting)
    // For simplicity, we assume it's placed on ground and stays there.
  }

  draw() {
    const g = this.gfx;
    g.clear();

    // Body: greenish blob
    g.fillStyle(0x44aa44, 1);
    g.fillCircle(0, 0, 14);

    // Eyes: white dots with black pupils (facing direction)
    g.fillStyle(0xffffff, 1);
    g.fillCircle(-5 * this.direction, -4, 5);
    g.fillCircle(5 * this.direction, -4, 5);
    g.fillStyle(0x000000, 1);
    g.fillCircle(-3 * this.direction, -4, 2);
    g.fillCircle(7 * this.direction, -4, 2);

    // Little legs (just for flavor)
    g.lineStyle(2, 0x33aa33, 1);
    g.lineBetween(-8, 8, -12, 14);
    g.lineBetween(8, 8, 12, 14);
  }
}