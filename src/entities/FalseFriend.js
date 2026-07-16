// ===== src/entities/FalseFriend.js =====
// A goomba-like enemy that studies the player's moves, prioritizes survival, then killing.
// States: STUDY, CHASE, FLEE, RANDOM.

const STUDY_DURATION = 4000; // ms

export default class FalseFriend extends Phaser.GameObjects.Container {
  constructor(scene, x, y) {
    super(scene, x, y);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setSize(20, 40);
    this.body.setOffset(-10, -40);
    this.body.setCollideWorldBounds(true);
    this.body.setMaxVelocity(200, 600);
    this.body.setDragX(400);

    this.gfx = scene.add.graphics();
    this.add(this.gfx);

    // Health
    this.health = 1;
    this.alive = true;

    // State
    this.state = 'STUDY';
    this.studyTimer = 0;
    this.studyData = [];

    // AI
    this.speed = 100;
    this.randomTimer = 0;
    this.randomDirection = 1;

    // Colors (orange base)
    this.bodyColor = 0xff8800;
    this.glowColor = 0xffaa44;

    this.draw();
  }

  update(time, delta, player) {
    if (!this.alive) return;
    const dt = delta / 1000;

    // ---- STUDY phase ----
    if (this.state === 'STUDY') {
      this.studyTimer += delta;
      this.studyData.push({ x: player.x, y: player.y, time: time });
      if (this.studyData.length > 200) this.studyData.shift();
      if (this.studyTimer >= STUDY_DURATION) {
        this._endStudy();
      }
      this.body.setVelocityX(0);
      this.draw();
      return;
    }

    // ---- After study: CHASE or FLEE ----
    if (this.state === 'CHASE' || this.state === 'FLEE') {
      // Check if trapped
      const vx = this.body.velocity.x;
      const dir = this.state === 'CHASE' ? Math.sign(player.x - this.x) : Math.sign(this.x - player.x);
      const blocked = (dir > 0 && vx < 10) || (dir < 0 && vx > -10);
      if (blocked && Math.abs(player.x - this.x) > 20) {
        this.state = 'RANDOM';
        this.randomTimer = 500 + Math.random() * 1500;
        this.randomDirection = Math.random() > 0.5 ? 1 : -1;
        this.body.setVelocityX(this.randomDirection * this.speed * 0.8);
        this.draw();
        return;
      }

      // Survival: avoid world edges (simplified)
      const edgeDistance = 50;
      if (this.x < edgeDistance) {
        this.body.setVelocityX(this.speed);
      } else if (this.x > this.scene.physics.world.bounds.width - edgeDistance) {
        this.body.setVelocityX(-this.speed);
      } else {
        if (this.state === 'CHASE') {
          this.body.setVelocityX(Math.sign(player.x - this.x) * this.speed);
        } else { // FLEE
          this.body.setVelocityX(Math.sign(this.x - player.x) * this.speed);
        }
      }
    } else if (this.state === 'RANDOM') {
      this.randomTimer -= delta;
      if (this.randomTimer <= 0) {
        this._decideState(player);
        if (this.state === 'CHASE' || this.state === 'FLEE') {
          const dir = this.state === 'CHASE' ? Math.sign(player.x - this.x) : Math.sign(this.x - player.x);
          this.body.setVelocityX(dir * this.speed);
        }
      } else {
        const vx = this.body.velocity.x;
        if ((this.randomDirection > 0 && vx < 10) || (this.randomDirection < 0 && vx > -10)) {
          this.randomDirection *= -1;
          this.body.setVelocityX(this.randomDirection * this.speed * 0.8);
        }
      }
    }

    this.draw();
  }

  _endStudy() {
    if (this.studyData.length < 10) {
      this.state = 'CHASE';
      return;
    }
    let avgVx = 0;
    for (let i = 1; i < this.studyData.length; i++) {
      const prev = this.studyData[i-1];
      const curr = this.studyData[i];
      const dt = (curr.time - prev.time) / 1000;
      if (dt > 0) avgVx += (curr.x - prev.x) / dt;
    }
    avgVx /= this.studyData.length;

    // Decide: if player moves toward us -> flee, else chase
    const dx = this.studyData[this.studyData.length-1].x - this.x;
    const movingTowards = (avgVx > 0 && dx > 0) || (avgVx < 0 && dx < 0);
    this.state = movingTowards ? 'FLEE' : 'CHASE';
    this.studyData = [];
  }

  _decideState(player) {
    const dx = player.x - this.x;
    this.state = (Math.abs(dx) < 150) ? 'FLEE' : 'CHASE';
  }

  takeDamage() {
    this.health--;
    if (this.health <= 0) this.die();
  }

  die() {
    this.alive = false;
    this.body.setAllowGravity(false);
    this.body.setVelocity(0, 0);
    this.visible = false;
  }

  draw() {
    const g = this.gfx;
    g.clear();

    let color = this.bodyColor;
    let glow = this.glowColor;
    if (this.state === 'STUDY') {
      color = 0x6666ff; glow = 0x8888ff;
    } else if (this.state === 'FLEE') {
      color = 0xff4444; glow = 0xff6666;
    } else if (this.state === 'CHASE') {
      color = 0xff8800; glow = 0xffaa44;
    } else if (this.state === 'RANDOM') {
      color = 0xff00ff; glow = 0xff66ff;
    }

    const headY = -32, shoulderY = -24, hipY = -10, headR = 7, legLen = 12;

    // Glow
    g.lineStyle(6, glow, 0.2);
    g.lineBetween(0, shoulderY, 0, hipY);
    g.lineBetween(0, hipY, -8, hipY + legLen);
    g.lineBetween(0, hipY, 8, hipY + legLen);
    g.lineBetween(0, shoulderY, -10, shoulderY + legLen);
    g.lineBetween(0, shoulderY, 10, shoulderY + legLen);
    g.fillStyle(glow, 0.2);
    g.fillCircle(0, headY - headR, headR + 4);

    // Main
    g.lineStyle(2, color, 1);
    g.lineBetween(0, shoulderY, 0, hipY);
    g.lineBetween(0, hipY, -8, hipY + legLen);
    g.lineBetween(0, hipY, 8, hipY + legLen);
    g.lineBetween(0, shoulderY, -10, shoulderY + legLen);
    g.lineBetween(0, shoulderY, 10, shoulderY + legLen);
    g.fillStyle(color, 1);
    g.fillCircle(0, headY - headR, headR);
  }
}