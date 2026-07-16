// Seagull-like bird that flies back and forth, vomits sticky fire blobs.

export default class VomitSeagull extends Phaser.GameObjects.Container {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x - spawn x (center)
   * @param {number} y - spawn y (flight height)
   * @param {number} minX - left flight boundary
   * @param {number} maxX - right flight boundary
   */
  constructor(scene, x, y, minX, maxX) {
    super(scene, x, y);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setAllowGravity(false);
    this.body.setSize(30, 20);
    this.body.setOffset(-15, -10);
    this.body.setCollideWorldBounds(true);

    // Flight parameters
    this.minX = minX || x - 200;
    this.maxX = maxX || x + 200;
    this.speedX = 80 + Math.random() * 40;
    this.direction = Math.random() > 0.5 ? 1 : -1;
    this.body.setVelocityX(this.direction * this.speedX);

    // Vertical bobbing
    this.bobPhase = Math.random() * Math.PI * 2;
    this.bobSpeed = 1.2;
    this.bobAmount = 10;
    this.baseY = y;

    // Vomit
    this.vomitCooldown = 0;
    this.vomitInterval = 2000 + Math.random() * 3000; // 2-5 seconds

    // Graphics
    this.gfx = scene.add.graphics();
    this.add(this.gfx);

    // Wing flap animation
    this.wingAngle = 0;
    this.flapSpeed = 6;

    // Store scene reference for spawning vomit
    this.sceneRef = scene;

    this.draw();
  }

  /**
   * Called every frame from the scene's update.
   * @param {number} time - current game time
   * @param {number} delta - delta time in ms
   */
  update(time, delta) {
    const dt = delta / 1000;

    // ---- Movement ----
    if (this.x > this.maxX) {
      this.direction = -1;
      this.body.setVelocityX(this.direction * this.speedX);
    } else if (this.x < this.minX) {
      this.direction = 1;
      this.body.setVelocityX(this.direction * this.speedX);
    }

    // Vertical bobbing
    this.bobPhase += dt * this.bobSpeed;
    const bobY = Math.sin(this.bobPhase) * this.bobAmount;
    this.y = this.baseY + bobY;

    // ---- Wing flap ----
    this.wingAngle += dt * this.flapSpeed;

    // ---- Vomit ----
    this.vomitCooldown -= delta;
    if (this.vomitCooldown <= 0) {
      this.vomit();
      this.vomitCooldown = this.vomitInterval + (Math.random() * 1000 - 500);
    }

    this.draw();
  }

  /** Fire a vomit blob downward. */
  vomit() {
    const scene = this.sceneRef;
    if (!scene || !scene.vomitGroup) return;

    const startX = this.x + (this.direction * 10);
    const startY = this.y + 12;

    // Create a blob: greenish-yellow, semi-transparent
    const blob = scene.add.circle(startX, startY, 8, 0xccaa33, 0.9);
    scene.physics.add.existing(blob);
    blob.body.setAllowGravity(true);
    blob.body.setCollideWorldBounds(false);
    blob.body.setSize(12, 12);
    blob.body.setOffset(-6, -6);

    // Initial velocity: downward with slight randomness
    const vx = (Math.random() - 0.5) * 60;
    const vy = 150 + Math.random() * 100;
    blob.body.setVelocity(vx, vy);

    // Store additional properties
    blob.isStuck = false;
    blob.dissolveTimer = 0;
    blob.dissolveDuration = 3000 + Math.random() * 2000; // 3-5 seconds

    // Add to group
    scene.vomitGroup.add(blob);
  }

  draw() {
    const g = this.gfx;
    g.clear();

    // ---- Seagull drawing ----
    // Body: white ellipse
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(0, 0, 36, 20);

    // Head: smaller circle offset to the right (facing direction)
    const headX = 18 * this.direction;
    g.fillCircle(headX, -4, 10);

    // Beak: yellow triangle pointing in facing direction
    g.fillStyle(0xffcc00, 1);
    const beakX = headX + 10 * this.direction;
    g.fillTriangle(
      headX, -8,
      beakX, -4,
      headX, 0
    );

    // Eye: black dot
    g.fillStyle(0x000000, 1);
    g.fillCircle(headX + 4 * this.direction, -6, 2);

    // ---- Wings ----
    // Left wing (upper) – flap angle
    const wingAngle = Math.sin(this.wingAngle) * 0.6 + 0.6; // 0 to 1.2 rad
    const wingLength = 28;
    const wingY = -8;

    g.fillStyle(0xcccccc, 1);
    const x1 = 0;
    const y1 = wingY;
    const x2 = x1 + Math.cos(wingAngle) * wingLength * this.direction;
    const y2 = y1 - Math.sin(wingAngle) * wingLength * 0.8;
    const x3 = x1 + Math.cos(wingAngle * 0.6) * (wingLength * 0.6) * this.direction;
    const y3 = y1 - Math.sin(wingAngle * 0.6) * (wingLength * 0.6) * 0.8;
    g.fillTriangle(x1, y1, x2, y2, x3, y3);

    // Right wing (lower) – opposite flap (mirror)
    const wingAngle2 = Math.sin(this.wingAngle + Math.PI) * 0.6 + 0.6;
    const x4 = 0;
    const y4 = wingY + 8;
    const x5 = x4 + Math.cos(wingAngle2) * wingLength * this.direction;
    const y5 = y4 - Math.sin(wingAngle2) * wingLength * 0.8;
    const x6 = x4 + Math.cos(wingAngle2 * 0.6) * (wingLength * 0.6) * this.direction;
    const y6 = y4 - Math.sin(wingAngle2 * 0.6) * (wingLength * 0.6) * 0.8;
    g.fillTriangle(x4, y4, x5, y5, x6, y6);

    // Tail: small gray triangle
    g.fillStyle(0xaaaaaa, 1);
    const tailX = -20 * this.direction;
    g.fillTriangle(
      -10, 0,
      tailX, -8,
      tailX, 8
    );
  }
}