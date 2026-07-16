const LIMB_COLOR = 0xffffff;
const LIMB_WIDTH = 3;

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
const GAIT_SPEED_FOR_FULL_CYCLE = 220; // px/s of horizontal speed that maps to a fast walk cycle

const MOVE_ACCEL = 900;
const MAX_SPEED_X = 260;
const MAX_SPEED_Y = 900;
const DRAG_X = 1400;
const JUMP_VELOCITY = -480;

/**
 * A stickman that IS the Arcade Physics body (gravity/velocity/collision live on
 * this container directly). Its pose is not spritesheet frames — every limb angle
 * is computed each frame from movement state (grounded/airborne/speed) and redrawn
 * as line segments pivoting from shoulder/hip points, like simple forward kinematics.
 */
export default class Stickman extends Phaser.GameObjects.Container {
  constructor(scene, x, y) {
    super(scene, x, y);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setSize(24, 60);
    this.body.setOffset(-12, -60);
    this.body.setCollideWorldBounds(true);
    this.body.setMaxVelocity(MAX_SPEED_X, MAX_SPEED_Y);
    this.body.setDragX(DRAG_X);

    this.gfx = scene.add.graphics();
    this.add(this.gfx);

    this.facing = 1;
    this.gaitPhase = 0;
    this.idlePhase = 0;
    this.pose = { leftLeg: 0, rightLeg: 0, leftArm: 0, rightArm: 0, bob: 0 };

    this.draw();
  }

  get grounded() {
    return this.body.blocked.down || this.body.touching.down;
  }

  setMove(dir) {
    if (dir !== 0) {
      this.body.setAccelerationX(MOVE_ACCEL * dir);
      this.facing = dir;
    } else {
      this.body.setAccelerationX(0);
    }
  }

  jump() {
    if (this.grounded) {
      this.body.setVelocityY(JUMP_VELOCITY);
    }
  }

  update(time, delta) {
    const dt = delta / 1000;
    const speed = this.body.velocity.x;
    const absSpeed = Math.abs(speed);

    this.setScale(this.facing, 1);

    if (!this.grounded) {
      this._updateAirbornePose();
    } else if (absSpeed > 8) {
      this._updateRunPose(dt, absSpeed);
    } else {
      this._updateIdlePose(dt);
    }

    this.draw();
  }

  _updateAirbornePose() {
    // Scissor pose: legs/arms mirror each other so a held jump reads as a spread
    // silhouette instead of converging onto a single overlapping line.
    const rising = this.body.velocity.y < 0;
    const legTarget = rising ? Phaser.Math.DegToRad(-30) : Phaser.Math.DegToRad(20);
    const armTarget = rising ? Phaser.Math.DegToRad(20) : Phaser.Math.DegToRad(-10);

    this.pose.leftLeg = Phaser.Math.Linear(this.pose.leftLeg, legTarget, 0.25);
    this.pose.rightLeg = Phaser.Math.Linear(this.pose.rightLeg, -legTarget, 0.25);
    this.pose.leftArm = Phaser.Math.Linear(this.pose.leftArm, armTarget, 0.25);
    this.pose.rightArm = Phaser.Math.Linear(this.pose.rightArm, -armTarget, 0.25);
    this.pose.bob = 0;
    this.gaitPhase = 0;
  }

  _updateRunPose(dt, absSpeed) {
    const cycleRate = 2 + (absSpeed / GAIT_SPEED_FOR_FULL_CYCLE) * 6;
    this.gaitPhase += dt * cycleRate;

    const swing = Math.sin(this.gaitPhase);
    this.pose.leftLeg = swing * MAX_LEG_SWING;
    this.pose.rightLeg = -swing * MAX_LEG_SWING;
    this.pose.leftArm = -swing * MAX_ARM_SWING;
    this.pose.rightArm = swing * MAX_ARM_SWING;
    this.pose.bob = Math.abs(swing) * 2;
  }

  _updateIdlePose(dt) {
    this.gaitPhase = 0;
    this.idlePhase += dt * 1.6;
    const sway = Math.sin(this.idlePhase) * IDLE_SWAY;

    this.pose.leftLeg = Phaser.Math.Linear(this.pose.leftLeg, IDLE_LEG_STANCE, 0.2);
    this.pose.rightLeg = Phaser.Math.Linear(this.pose.rightLeg, -IDLE_LEG_STANCE, 0.2);
    this.pose.leftArm = IDLE_ARM_STANCE + sway;
    this.pose.rightArm = -IDLE_ARM_STANCE - sway;
    this.pose.bob = Math.sin(this.idlePhase) * 1;
  }

  draw() {
    const g = this.gfx;
    g.clear();

    const bob = this.pose.bob || 0;
    const headY = HEAD_Y + bob;
    const shoulderY = SHOULDER_Y + bob;
    const hipY = HIP_Y + bob * 0.5;

    g.lineStyle(LIMB_WIDTH, LIMB_COLOR, 1);

    this._drawLimb(0, hipY, this.pose.leftLeg, LEG_LENGTH);
    this._drawLimb(0, hipY, this.pose.rightLeg, LEG_LENGTH);

    g.lineBetween(0, shoulderY, 0, hipY);

    this._drawLimb(0, shoulderY, this.pose.leftArm, ARM_LENGTH);
    this._drawLimb(0, shoulderY, this.pose.rightArm, ARM_LENGTH);

    g.fillStyle(LIMB_COLOR, 1);
    g.fillCircle(0, headY - HEAD_RADIUS, HEAD_RADIUS);
  }

  _drawLimb(pivotX, pivotY, angle, length) {
    const endX = pivotX + Math.sin(angle) * length;
    const endY = pivotY + Math.cos(angle) * length;
    this.gfx.lineBetween(pivotX, pivotY, endX, endY);
  }
}
