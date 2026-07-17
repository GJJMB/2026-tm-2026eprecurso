import Actor from './Actor.js';
import { CELL_SIZE } from '../world/levelFormat.js';

const LIMB_COLOR = 0x1a1a2a;        // dark base
const GLOW_COLOR = 0x00ccff;        // neon cyan glow
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

const MOVE_ACCEL = 560;
const MAX_SPEED_X = 580;
const MAX_SPEED_Y = 1000;
const DRAG_X = 1400;
const JUMP_VELOCITY = -480;

// --- Inertia / lean ---
const MAX_LEAN_ANGLE = Phaser.Math.DegToRad(15);  // max tilt (radians)
const LEAN_SMOOTHNESS = 6.0;                      // per second

// --- Impact / landing squash ---
const HIT_DURATION = 0.2;
const SQUASH_FACTOR = 0.2;

// --- Double jump ---
const MAX_JUMPS = 1;                                      // ground jump + 1 air jump
const DOUBLE_JUMP_VELOCITY = -420;
const DOUBLE_JUMP_SPIN_DURATION = 0.25;                    // seconds the flip animation plays
const DOUBLE_JUMP_SPIN_AMOUNT = Phaser.Math.DegToRad(360); // one full rotation

// --- Wall jump ---
const WALL_SLIDE_SPEED = 60;        // max fall speed while sliding down a wall
const WALL_JUMP_VELOCITY_X = 300;   // horizontal kick away from wall
const WALL_JUMP_VELOCITY_Y = -420;  // upward kick
const WALL_JUMP_LOCKOUT = 0.15;     // seconds player can't re-steer after wall jump
const WALL_COYOTE_TIME = 0.1;       // grace period after leaving a wall

export default class Stickman extends Actor {
  constructor(scene, x, y) {
    super(scene, x, y);

    // 1 cell wide by 2 cells tall, so the hitbox lines up consistently with the grid
    // regardless of the section's own visual scale.
    this.body.setSize(CELL_SIZE, CELL_SIZE * 2);
    this.body.setOffset(-CELL_SIZE / 2, -CELL_SIZE * 2);
    this.body.setCollideWorldBounds(true);
    this.body.setMaxVelocity(MAX_SPEED_X, MAX_SPEED_Y);
    this.body.setDragX(DRAG_X);

    this.facing = 1;
    this.gaitPhase = 0;
    this.idlePhase = 0;

    this.pose = { leftLeg: 0, rightLeg: 0, leftArm: 0, rightArm: 0, bob: 0 };

    // --- Lean (inertia) ---
    this.lean = 0;

    // --- Hit reaction ---
    this.hitTime = 0;
    this.wasGrounded = false;

    // --- Double jump state ---
    this.jumpsUsed = 0;
    this.doubleJumpTimer = 0;

    // --- Wall jump state ---
    this.wallSide = 0;          // -1 = wall on left, 1 = wall on right, 0 = none
    this.wallCoyoteTimer = 0;
    this.wallJumpLockTimer = 0;

    this.draw();
  }

  /** Repositions the player (e.g. to a checkpoint after losing a life — see
   * GameScene._respawnPlayer) and resets every per-life movement/pose field back to its
   * constructor default, so a respawn behaves identically to an initial spawn rather than
   * carrying over jump/wall-slide/lean state from just before the death. */
  respawn(x, y) {
    this.body.reset(x, y);
    this.body.setAcceleration(0, 0);

    this.facing = 1;
    this.gaitPhase = 0;
    this.idlePhase = 0;
    this.pose = { leftLeg: 0, rightLeg: 0, leftArm: 0, rightArm: 0, bob: 0 };
    this.lean = 0;
    this.hitTime = 0;
    this.wasGrounded = false;
    this.jumpsUsed = 0;
    this.doubleJumpTimer = 0;
    this.wallSide = 0;
    this.wallCoyoteTimer = 0;
    this.wallJumpLockTimer = 0;

    this.draw();
  }

  get grounded() {
    return this.body.blocked.down || this.body.touching.down;
  }

  get onWallLeft() {
    return this.body.blocked.left || this.body.touching.left;
  }

  get onWallRight() {
    return this.body.blocked.right || this.body.touching.right;
  }

  get onWall() {
    return (this.onWallLeft || this.onWallRight) && !this.grounded;
  }

  setMove(dir) {
    if (this.wallJumpLockTimer > 0) return; // ignore steering briefly after a wall jump

    if (dir !== 0) {
      this.body.setAccelerationX(MOVE_ACCEL * dir);
      this.facing = dir;
    } else {
      this.body.setAccelerationX(0);
    }
  }

  /**
   * Single jump input. Handles ground jump, wall jump, and double jump
   * with priority: ground > wall > air (double).
   * Returns true if a jump was actually triggered, false otherwise.
   */
  jump() {
    if (this.grounded) {
      this.body.setVelocityY(JUMP_VELOCITY);
      this.jumpsUsed = 1;
      return true;
    }

    if (this.wallSide !== 0) {
      return this._wallJump();
    }

    if (this.jumpsUsed < MAX_JUMPS) {
      this.body.setVelocityY(DOUBLE_JUMP_VELOCITY);
      this.jumpsUsed++;
      //this.doubleJumpTimer = DOUBLE_JUMP_SPIN_DURATION;
      return true;
    }

    return false;
  }

  _wallJump() {
    const kickDir = -this.wallSide; // jump away from the wall
    this.body.setVelocityX(WALL_JUMP_VELOCITY_X * kickDir);
    this.body.setVelocityY(WALL_JUMP_VELOCITY_Y);
    this.facing = kickDir;

    this.wallJumpLockTimer = WALL_JUMP_LOCKOUT;
    this.wallSide = 0;
    this.wallCoyoteTimer = 0;
    this.jumpsUsed = 1; // still leaves one air jump available after a wall jump

    this.hitTime = HIT_DURATION * 0.5; // small impact squash for feedback

    return true;
  }

  update(time, delta) {
    const dt = Math.min(delta / 1000, 1 / 30);
    const absSpeed = Math.abs(this.body.velocity.x);

    // --- Detect landing ---
    const isGrounded = this.grounded;
    if (isGrounded && !this.wasGrounded) {
      this.hitTime = HIT_DURATION;
    }
    this.wasGrounded = isGrounded;

    if (isGrounded) {
      this.jumpsUsed = 0;
      this.wallSide = 0;
      this.wallCoyoteTimer = 0;
    }

    // --- Update hit timer ---
    if (this.hitTime > 0) {
      this.hitTime -= dt;
      if (this.hitTime < 0) this.hitTime = 0;
    }

    // --- Update double jump spin timer ---
    if (this.doubleJumpTimer > 0) {
      this.doubleJumpTimer -= dt;
      if (this.doubleJumpTimer < 0) this.doubleJumpTimer = 0;
    }

    // --- Wall detection / coyote time ---
    if (this.onWallLeft) {
      this.wallSide = -1;
      this.wallCoyoteTimer = WALL_COYOTE_TIME;
    } else if (this.onWallRight) {
      this.wallSide = 1;
      this.wallCoyoteTimer = WALL_COYOTE_TIME;
    } else if (this.wallCoyoteTimer > 0) {
      this.wallCoyoteTimer -= dt;
    } else {
      this.wallSide = 0;
    }

    if (this.wallJumpLockTimer > 0) {
      this.wallJumpLockTimer -= dt;
    }

    // --- Wall slide: clamp fall speed while pressed against a wall ---
    if (this.onWall && this.body.velocity.y > WALL_SLIDE_SPEED) {
      this.body.setVelocityY(WALL_SLIDE_SPEED);
    }

    // --- Compute target lean based on velocity (inertia) ---
    const targetLean = Phaser.Math.Clamp(this.body.velocity.x / MAX_SPEED_X, -1, 1) * MAX_LEAN_ANGLE;
    // Smoothly interpolate lean
    this.lean += (targetLean - this.lean) * (1 - Math.exp(-LEAN_SMOOTHNESS * dt));

    // --- Update pose ---
    let targets;
    if (!this.grounded && this.doubleJumpTimer > 0) {
      targets = this._doubleJumpTargets();
    } else if (!this.grounded && this.wallSide !== 0) {
      targets = this._wallSlideTargets();
    } else if (!this.grounded) {
      targets = this._updateAirbornePose();
    } else if (absSpeed > 8) {
      targets = this._runTargets(dt, absSpeed);
    } else {
      targets = this._idleTargets(dt);
    }
    Object.assign(this.pose, targets);

    this.draw();
  }

  _updateAirbornePose() {
    const rising = this.body.velocity.y < 0;
    const leg = rising ? Phaser.Math.DegToRad(-30) : Phaser.Math.DegToRad(20);
    const arm = rising ? Phaser.Math.DegToRad(20) : Phaser.Math.DegToRad(-10);

    this.gaitPhase = 0;
    return { leftLeg: leg, rightLeg: -leg, leftArm: arm, rightArm: -arm, bob: 0 };
  }

  _doubleJumpTargets() {
    // Tight tucked pose while the flip spin plays
    this.gaitPhase = 0;
    return {
      leftLeg: Phaser.Math.DegToRad(-25),
      rightLeg: Phaser.Math.DegToRad(25),
      leftArm: Phaser.Math.DegToRad(-45),
      rightArm: Phaser.Math.DegToRad(45),
      bob: 0,
    };
  }

  _wallSlideTargets() {
    // Arms/legs press flat toward the wall
    this.gaitPhase = 0;
    const lean = this.wallSide;
    return {
      leftLeg: Phaser.Math.DegToRad(15) * lean,
      rightLeg: Phaser.Math.DegToRad(-15) * lean,
      leftArm: Phaser.Math.DegToRad(35) * lean,
      rightArm: Phaser.Math.DegToRad(-10) * lean,
      bob: 0,
    };
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

  draw() {
    const g = this.gfx;
    g.clear();

    // --- Hit intensity for squash ---
    let hitIntensity = 0;
    if (this.hitTime > 0) {
      hitIntensity = this.hitTime / HIT_DURATION;
    }
    const squash = 1 - hitIntensity * SQUASH_FACTOR;

    // // --- Double jump spin: full rotation that eases out over the flip duration ---
    // let spinRotation = 0;
    // if (this.doubleJumpTimer > 0) {
    //   const spinProgress = 1 - (this.doubleJumpTimer / DOUBLE_JUMP_SPIN_DURATION);
    //   spinRotation = DOUBLE_JUMP_SPIN_AMOUNT * spinProgress * this.facing;
    // }

    // --- Apply transform: scale (facing + squash) and rotation (lean + spin) ---
    this.setScale(this.facing, squash);
    this.setRotation(this.lean);

    // --- Pose offsets (scaled vertically by squash) ---
    const bob = this.pose.bob || 0;
    const headY = (HEAD_Y + bob) * squash;
    const shoulderY = (SHOULDER_Y + bob) * squash;
    const hipY = (HIP_Y + bob * 0.5) * squash;

    // --- Glow layers (same as before) ---
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

    // --- Main dark limbs ---
    g.lineStyle(LIMB_WIDTH, LIMB_COLOR, 1);
    this._drawLimb(0, hipY, this.pose.leftLeg, LEG_LENGTH);
    this._drawLimb(0, hipY, this.pose.rightLeg, LEG_LENGTH);
    g.lineBetween(0, shoulderY, 0, hipY);
    this._drawLimb(0, shoulderY, this.pose.leftArm, ARM_LENGTH);
    this._drawLimb(0, shoulderY, this.pose.rightArm, ARM_LENGTH);

    // --- Head ---
    g.fillStyle(LIMB_COLOR, 1);
    g.fillCircle(0, headY - HEAD_RADIUS, HEAD_RADIUS);

    // --- Head glow highlight ---
    g.fillStyle(GLOW_COLOR, 0.12);
    g.fillCircle(2, headY - HEAD_RADIUS - 2, HEAD_RADIUS * 0.5);
  }

  _drawLimb(pivotX, pivotY, angle, length) {
    const endX = pivotX + Math.sin(angle) * length;
    const endY = pivotY + Math.cos(angle) * length;
    this.gfx.lineBetween(pivotX, pivotY, endX, endY);
  }
}