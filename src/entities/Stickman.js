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

// Underdamped spring-damper: limbs overshoot their target pose and wobble back to
// rest instead of snapping to it, which is what reads as "floppy" (Stick Fight-ish)
// rather than a stiff puppet. Critical damping for this stiffness would be ~2*sqrt(320)
// =~ 36; staying well under that keeps the bounce visible.
const LIMB_SPRING_STIFFNESS = 320;
const LIMB_SPRING_DAMPING = 16;
const BOB_SPRING_STIFFNESS = 260;
const BOB_SPRING_DAMPING = 14;

// Whole-body lean driven by horizontal acceleration: leaning into a direction change
// (and whipping back when it reverses) is most of what sells "floppy" at a glance.
const LEAN_SPRING_STIFFNESS = 140;
const LEAN_SPRING_DAMPING = 9;
const MAX_LEAN = Phaser.Math.DegToRad(20);
const LEAN_ACCEL_SCALE = MAX_LEAN / MOVE_ACCEL;

/**
 * A stickman that IS the Arcade Physics body (gravity/velocity/collision live on
 * this container directly). Its pose is not spritesheet frames — every limb angle
 * is computed each frame from movement state (grounded/airborne/speed) as a target,
 * then a spring-damper eases the actual drawn angle toward that target so motion
 * overshoots and settles instead of snapping ("floppy" secondary motion). Physics
 * collision (the Arcade body) is unaffected by this — only the Graphics redraw is.
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

    this.pose = { leftLeg: 0, rightLeg: 0, leftArm: 0, rightArm: 0, bob: 0, lean: 0 };
    this.poseVel = { leftLeg: 0, rightLeg: 0, leftArm: 0, rightArm: 0, bob: 0, lean: 0 };

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

  /** Returns true if a jump was actually triggered (i.e. was grounded), false otherwise. */
  jump() {
    if (this.grounded) {
      this.body.setVelocityY(JUMP_VELOCITY);
      return true;
    }
    return false;
  }

  update(time, delta) {
    const dt = Math.min(delta / 1000, 1 / 30);
    const absSpeed = Math.abs(this.body.velocity.x);

    this.setScale(this.facing, 1);

    const targets = !this.grounded
      ? this._airborneTargets()
      : absSpeed > 8
        ? this._runTargets(dt, absSpeed)
        : this._idleTargets(dt);

    const leanTarget = Phaser.Math.Clamp(this.body.acceleration.x * LEAN_ACCEL_SCALE, -MAX_LEAN, MAX_LEAN);

    this._spring('leftLeg', targets.leftLeg, dt, LIMB_SPRING_STIFFNESS, LIMB_SPRING_DAMPING);
    this._spring('rightLeg', targets.rightLeg, dt, LIMB_SPRING_STIFFNESS, LIMB_SPRING_DAMPING);
    this._spring('leftArm', targets.leftArm, dt, LIMB_SPRING_STIFFNESS, LIMB_SPRING_DAMPING);
    this._spring('rightArm', targets.rightArm, dt, LIMB_SPRING_STIFFNESS, LIMB_SPRING_DAMPING);
    this._spring('bob', targets.bob, dt, BOB_SPRING_STIFFNESS, BOB_SPRING_DAMPING);
    this._spring('lean', leanTarget, dt, LEAN_SPRING_STIFFNESS, LEAN_SPRING_DAMPING);

    this.draw();
  }

  _spring(key, target, dt, stiffness, damping) {
    const value = this.pose[key];
    const vel = this.poseVel[key];
    const accel = (target - value) * stiffness - vel * damping;
    const nextVel = vel + accel * dt;
    this.pose[key] = value + nextVel * dt;
    this.poseVel[key] = nextVel;
  }

  _airborneTargets() {
    // Scissor pose: legs/arms mirror each other so a held jump reads as a spread
    // silhouette instead of converging onto a single overlapping line.
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

  draw() {
    const g = this.gfx;
    g.clear();
    g.rotation = this.pose.lean;

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
