// ===== ./src/entities/enemyType1.js =====

// Enemy stickman with a sling – shoots projectiles at the player.
// Colored bright red, patrols between two points, and fires when the player is close.

const LIMB_COLOR = 0xff3333;          // bright red base
const GLOW_COLOR = 0xff6666;          // lighter red glow
const LIMB_WIDTH = 3;
const GLOW_WIDTH = 8;

const HEAD_RADIUS = 8;
const HEAD_Y = -56;
const SHOULDER_Y = -44;
const HIP_Y = -20;

const ARM_LENGTH = 16;
const LEG_LENGTH = 20;

const MAX_LEG_SWING = Phaser.Math.DegToRad(38);
const MAX_ARM_SWING = Phaser.Math.DegToRad(30);
const IDLE_SWAY = Phaser.Math.DegToRad(4);
const IDLE_LEG_STANCE = Phaser.Math.DegToRad(7);
const IDLE_ARM_STANCE = Phaser.Math.DegToRad(14);
const GAIT_SPEED_FOR_FULL_CYCLE = 220;

const MAX_SPEED_X = 100;              // patrol speed
const MAX_SPEED_Y = 400;
const DRAG_X = 300;

// Inertia / lean (less pronounced for enemy)
const MAX_LEAN_ANGLE = Phaser.Math.DegToRad(8);
const LEAN_SMOOTHNESS = 4.0;

export default class SlingerEnemy extends Phaser.GameObjects.Container {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x - spawn x
   * @param {number} y - spawn y (ground level recommended)
   * @param {number} patrolMin - left patrol bound (world x)
   * @param {number} patrolMax - right patrol bound (world x)
   */
  constructor(scene, x, y, patrolMin, patrolMax) {
    super(scene, x, y);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setSize(24, 60);
    this.body.setOffset(-12, -60);
    this.body.setCollideWorldBounds(true);
    this.body.setMaxVelocity(MAX_SPEED_X, MAX_SPEED_Y);
    this.body.setDragX(DRAG_X);
    this.body.setImmovable(false); // can be pushed? We'll keep it solid but not immovable

    this.gfx = scene.add.graphics();
    this.add(this.gfx);

    // Facing direction: 1 = right, -1 = left
    this.facing = 1;
    this.gaitPhase = 0;
    this.idlePhase = 0;
    this.pose = { leftLeg: 0, rightLeg: 0, leftArm: 0, rightArm: 0, bob: 0 };
    this.lean = 0;

    // AI
    this.patrolMin = patrolMin || x - 150;
    this.patrolMax = patrolMax || x + 150;
    this.shootRange = 400;
    this.shootCooldown = 0;
    this.shootInterval = 1500; // ms between shots
    this.projectileSpeed = 300;

    // Reference to the player (set externally or passed each update)
    this.playerRef = null;

    this.draw();
  }

  get grounded() {
    return this.body.blocked.down || this.body.touching.down;
  }

  /**
   * Called every frame from the scene's update.
   * @param {number} time - current game time
   * @param {number} delta - delta time in ms
   * @param {Phaser.GameObjects.GameObject} player - the player object (used for targeting)
   */
  update(time, delta, player) {
    const dt = Math.min(delta / 1000, 1 / 30);
    this.playerRef = player;

    // ---- AI logic ----
    const dx = player.x - this.x;
    const dist = Math.abs(dx);
    const verticalDist = Math.abs(player.y - this.y);

    // If player is within range and roughly at same height, face and shoot
    if (dist < this.shootRange && verticalDist < 80) {
      this.facing = Math.sign(dx);
      this.body.setVelocityX(0);
      // Shoot if cooldown is ready
      if (this.shootCooldown <= 0) {
        this.shoot(player);
        this.shootCooldown = this.shootInterval;
      }
    } else {
      // Patrol: move towards current facing, reverse at bounds
      this.body.setVelocityX(this.facing * 50);
      if (this.x > this.patrolMax) this.facing = -1;
      if (this.x < this.patrolMin) this.facing = 1;
    }

    // Update cooldown
    if (this.shootCooldown > 0) {
      this.shootCooldown -= delta;
    }

    // ---- Animation update (borrowed from Stickman) ----
    const absSpeed = Math.abs(this.body.velocity.x);
    let targets;
    if (!this.grounded) {
      targets = this._updateAirbornePose();
    } else if (absSpeed > 8) {
      targets = this._runTargets(dt, absSpeed);
    } else {
      targets = this._idleTargets(dt);
    }
    Object.assign(this.pose, targets);

    // Lean (inertia) – simplified for enemy
    const targetLean = Phaser.Math.Clamp(this.body.velocity.x / MAX_SPEED_X, -1, 1) * MAX_LEAN_ANGLE;
    this.lean += (targetLean - this.lean) * (1 - Math.exp(-LEAN_SMOOTHNESS * dt));

    this.draw();
  }

  _updateAirbornePose() {
    const rising = this.body.velocity.y < 0;
    const leg = rising ? Phaser.Math.DegToRad(-30) : Phaser.Math.DegToRad(20);
    const arm = rising ? Phaser.Math.DegToRad(20) : Phaser.Math.DegToRad(-10);
    this.gaitPhase = 0;
    return { leftLeg: leg, rightLeg: -leg, leftArm: arm, rightArm: -arm, bob: 0 };
  }

  _runTargets(dt, absSpeed) {
    const cycleRate = 2 + (absSpeed / GAIT_SPEED_FOR_FULL_CYCLE) * 6;
    this.gaitPhase += dt * cycleRate;
    const swing = Math.sin(this.gaitPhase);
    return {
      leftLeg: swing * MAX_LEG_SWING,
      rightLeg: -swing * MAX_LEG_SWING,
      leftArm: -swing * MAX_ARM_SWING,
      rightArm: swing * MAX_ARM_SWING,
      bob: Math.abs(swing) * 2,
    };
  }

  _idleTargets(dt) {
    this.gaitPhase = 0;
    this.idlePhase += dt * 1.6;
    const sway = Math.sin(this.idlePhase) * IDLE_SWAY;
    return {
      leftLeg: IDLE_LEG_STANCE,
      rightLeg: -IDLE_LEG_STANCE,
      leftArm: IDLE_ARM_STANCE + sway,
      rightArm: -IDLE_ARM_STANCE - sway,
      bob: Math.sin(this.idlePhase) * 1,
    };
  }

  /**
   * Fire a projectile towards the player.
   * The projectile is added to the scene's physics group (must be pre‑created).
   * @param {Phaser.GameObjects.GameObject} player
   */
  shoot(player) {
    if (!this.scene.projectiles) {
      console.warn('SlingerEnemy: no projectiles group found in scene');
      return;
    }

    // Spawn projectile slightly in front of the enemy, at hand height
    const startX = this.x + this.facing * 20;
    const startY = this.y + SHOULDER_Y + ARM_LENGTH * 0.6; // approximate hand position

    // Calculate direction towards player
    const dx = player.x - startX;
    const dy = player.y - startY;
    const angle = Math.atan2(dy, dx);
    const speed = this.projectileSpeed;

    // Create a small rectangle as projectile
    const proj = this.scene.add.rectangle(startX, startY, 8, 8, 0xff0000);
    this.scene.physics.add.existing(proj);
    proj.body.setAllowGravity(false);
    proj.body.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
    proj.body.setCollideWorldBounds(false);
    proj.body.onWorldBounds = true; // will be destroyed on leaving world

    // Store reference to the enemy that shot it (for debugging, optional)
    proj.shooter = this;

    // Add to the scene's projectile group for easy cleanup and collision
    this.scene.projectiles.add(proj);

    // Optional: play a sound here (if you have a "shoot" event)
    // this.scene.sfx?.play('shoot');
  }

  // ---- Drawing ----
  draw() {
    const g = this.gfx;
    g.clear();

    // Apply facing and slight lean
    this.setScale(this.facing, 1);
    this.setRotation(this.lean);

    const bob = this.pose.bob || 0;
    const headY = HEAD_Y + bob;
    const shoulderY = SHOULDER_Y + bob;
    const hipY = HIP_Y + bob * 0.5;

    // ---- Glow layers ----
    g.lineStyle(GLOW_WIDTH, GLOW_COLOR, 0.15);
    this._drawLimb(0, hipY, this.pose.leftLeg, LEG_LENGTH);
    this._drawLimb(0, hipY, this.pose.rightLeg, LEG_LENGTH);
    g.lineBetween(0, shoulderY, 0, hipY);
    this._drawLimb(0, shoulderY, this.pose.leftArm, ARM_LENGTH);
    this._drawLimb(0, shoulderY, this.pose.rightArm, ARM_LENGTH);
    g.fillStyle(GLOW_COLOR, 0.15);
    g.fillCircle(0, headY - HEAD_RADIUS, HEAD_RADIUS + 4);

    g.lineStyle(5, GLOW_COLOR, 0.25);
    this._drawLimb(0, hipY, this.pose.leftLeg, LEG_LENGTH);
    this._drawLimb(0, hipY, this.pose.rightLeg, LEG_LENGTH);
    g.lineBetween(0, shoulderY, 0, hipY);
    this._drawLimb(0, shoulderY, this.pose.leftArm, ARM_LENGTH);
    this._drawLimb(0, shoulderY, this.pose.rightArm, ARM_LENGTH);
    g.fillStyle(GLOW_COLOR, 0.25);
    g.fillCircle(0, headY - HEAD_RADIUS, HEAD_RADIUS + 2);

    // ---- Main red limbs ----
    g.lineStyle(LIMB_WIDTH, LIMB_COLOR, 1);
    this._drawLimb(0, hipY, this.pose.leftLeg, LEG_LENGTH);
    this._drawLimb(0, hipY, this.pose.rightLeg, LEG_LENGTH);
    g.lineBetween(0, shoulderY, 0, hipY);
    this._drawLimb(0, shoulderY, this.pose.leftArm, ARM_LENGTH);
    this._drawLimb(0, shoulderY, this.pose.rightArm, ARM_LENGTH);

    // ---- Head ----
    g.fillStyle(LIMB_COLOR, 1);
    g.fillCircle(0, headY - HEAD_RADIUS, HEAD_RADIUS);

    // Head glow highlight
    g.fillStyle(GLOW_COLOR, 0.12);
    g.fillCircle(2, headY - HEAD_RADIUS - 2, HEAD_RADIUS * 0.5);

    // ---- Sling visual (optional) ----
    // Draw a small sling pouch on the right arm (if facing right) or left arm
    // We'll just draw a tiny circle at the hand of the forward arm.
    const armAngle = this.facing === 1 ? this.pose.rightArm : this.pose.leftArm;
    const armSide = this.facing === 1 ? 0 : 0; // we'll calculate manually
    const handX = Math.sin(armAngle) * ARM_LENGTH;
    const handY = shoulderY + Math.cos(armAngle) * ARM_LENGTH;
    g.fillStyle(0x884422, 0.8);
    g.fillCircle(handX, handY, 3);
    // Add a tiny line representing the sling cord
    g.lineStyle(1, 0x884422, 0.5);
    g.lineBetween(0, shoulderY, handX, handY);
  }

  _drawLimb(pivotX, pivotY, angle, length) {
    const endX = pivotX + Math.sin(angle) * length;
    const endY = pivotY + Math.cos(angle) * length;
    this.gfx.lineBetween(pivotX, pivotY, endX, endY);
  }
}