// Responsive Sidescrolling Character Controller (FSM) for Pixel Knight

import { Animator, PIVOT_X, PIVOT_Y } from './sprites.js';
import { rectsOverlap } from './level.js';

export const STAND_W = 14;
export const STAND_H = 34;
export const CROUCH_H = 20;

// Physics tuning (world units = native sprite pixels, 480x270 viewport)
const RUN_SPEED = 136;
const CROUCH_SPEED = 56;
const GROUND_ACCEL = 1150;
const GROUND_DECEL = 1280;
const AIR_ACCEL = 780;
const AIR_DECEL = 320;
const GRAVITY = 760;
const FALL_GRAVITY_MULT = 1.28;
const MAX_FALL_SPEED = 360;
const JUMP_VEL = -268;
const JUMP_CUT_MULT = 0.48;
const COYOTE_TIME = 0.11;
const JUMP_BUFFER_TIME = 0.12;

const DASH_SPEED = 315;
const DASH_DURATION = 0.155;
const DASH_COOLDOWN = 0.65;

const ROLL_SPEED = 178;
const SLIDE_SPEED = 228;
const SLIDE_DURATION = 0.30;

const WALL_SLIDE_SPEED = 66;
const WALL_JUMP_VX = 166;
const WALL_JUMP_VY = -258;
const WALL_JUMP_LOCK = 0.12;

export class Player {
  constructor(x, y) {
    this.spawnX = x;
    this.spawnY = y;

    // Position is bottom-center of collider (feet!)
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.w = STAND_W;
    this.h = STAND_H;
    this.facing = 1; // 1 = right, -1 = left

    this.state = 'IDLE';
    this.animator = new Animator();

    // Ground & wall contact flags
    this.onGround = false;
    this.onOneWay = false;
    this.wallDir = 0; // -1 = wall on left, +1 = wall on right

    // Game-feel timers
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.dropThroughTimer = 0;
    this.wallJumpLockTimer = 0;
    this.ledgeCooldown = 0;
    this.turnVisualFacing = 1;

    // Dash / Slide / Roll state
    this.dashTimer = 0;
    this.dashCooldown = 0;
    this.airDashReady = true;
    this.afterimageTimer = 0;
    this.slidePhase = 'start';
    this.slideTimer = 0;
    this.rollDodgedHazard = false;

    // Ledge grab / climb anchor
    this.ledge = null; // { x, y, dir }

    // Combat state
    this.comboQueued = false;
    this.attackHasHit = false;
    this.activeHitbox = null;
    this.comboCount = 0;
    this.comboResetTimer = 0;

    // Health & damage
    this.maxHp = 5;
    this.hp = this.maxHp;
    this.invulnTimer = 0;
    this.hitTimer = 0;
    this.deathTimer = 0;

    // Visual squash/stretch & step SFX tracker
    this.scaleX = 1;
    this.scaleY = 1;
    this.lastRunStepFrame = -1;

    // Camera shake / hitstop requests consumed by main loop
    this.pendingShake = 0;
    this.pendingHitstop = 0;
  }

  get left()   { return this.x - this.w / 2; }
  get right()  { return this.x + this.w / 2; }
  get top()    { return this.y - this.h; }
  get bottom() { return this.y; }

  get isInvulnerable() {
    if (this.invulnTimer > 0) return true;
    if (this.state === 'ROLL' && this.animator.frame >= 1 && this.animator.frame <= 8) return true;
    if (this.state === 'DASH') return true;
    return false;
  }

  respawn(fullHeal = true) {
    this.x = this.spawnX;
    this.y = this.spawnY;
    this.vx = 0;
    this.vy = 0;
    this.h = STAND_H;
    this.facing = 1;
    this.state = 'IDLE';
    this.animator.play('idle', true);
    this.onGround = false;
    this.ledge = null;
    this.activeHitbox = null;
    this.airDashReady = true;
    this.dashCooldown = 0;
    this.invulnTimer = 0.6;
    this.hitTimer = 0;
    this.deathTimer = 0;
    if (fullHeal) this.hp = this.maxHp;
  }

  triggerHurt(dirX, particles, audio, damage = 1) {
    if (this.state === 'DEATH') return;
    this.hp = Math.max(0, this.hp - damage);
    this.activeHitbox = null;
    this.ledge = null;
    this.h = STAND_H;
    this.pendingShake = 5.5;
    this.pendingHitstop = 0.055;
    particles.spawnSparks(this.x, this.y - this.h * 0.5, 12, '#ff9aa4', '#e04151', dirX);

    if (this.hp <= 0) {
      this.triggerDeath(particles, audio);
      return;
    }

    this.state = 'HIT';
    this.hitTimer = 0.30;
    this.invulnTimer = 1.15;
    this.vx = (dirX || -this.facing) * 125;
    this.vy = -165;
    this.onGround = false;
    this.animator.play('hit', true);
    audio.hurt();
    particles.addText(this.x, this.top - 4, `-${damage} HP`, '#ff6b7a', 0.8);
  }

  triggerDeath(particles, audio) {
    if (this.state === 'DEATH') return;
    this.hp = 0;
    this.state = 'DEATH';
    this.deathTimer = 1.8;
    this.activeHitbox = null;
    this.ledge = null;
    this.h = STAND_H;
    this.vx = -this.facing * 55;
    this.vy = Math.min(this.vy, -80);
    this.animator.play('death', true);
    this.pendingShake = 7;
    this.pendingHitstop = 0.07;
    audio.death();
    particles.addText(this.x, this.top - 6, 'FALLEN', '#ff596a', 1.2);
  }

  update(dt, input, level, particles, audio) {
    // Tick passive timers
    if (this.coyoteTimer > 0) this.coyoteTimer -= dt;
    if (this.jumpBufferTimer > 0) this.jumpBufferTimer -= dt;
    if (this.dropThroughTimer > 0) this.dropThroughTimer -= dt;
    if (this.wallJumpLockTimer > 0) this.wallJumpLockTimer -= dt;
    if (this.ledgeCooldown > 0) this.ledgeCooldown -= dt;
    if (this.dashCooldown > 0) this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (this.comboResetTimer > 0) {
      this.comboResetTimer -= dt;
      if (this.comboResetTimer <= 0) this.comboCount = 0;
    }

    // Relax squash & stretch smoothly back to 1
    this.scaleX += (1 - this.scaleX) * Math.min(1, dt * 16);
    this.scaleY += (1 - this.scaleY) * Math.min(1, dt * 16);

    // Buffer jump press
    if (input.jumpPressed) {
      this.jumpBufferTimer = JUMP_BUFFER_TIME;
    }

    // Demo test hotkeys for Hit & Death animations
    if (input.testHitPressed && this.state !== 'DEATH') {
      this.triggerHurt(-this.facing, particles, audio, 1);
    }
    if (input.testDeathPressed && this.state !== 'DEATH') {
      this.triggerDeath(particles, audio);
    }

    // Clear active attack hitbox each frame before state logic sets it
    this.activeHitbox = null;

    // ---- STATE MACHINE ----
    switch (this.state) {
      case 'DEATH':
        this._updateDeath(dt, level, particles);
        break;
      case 'HIT':
        this._updateHit(dt, level, particles);
        break;
      case 'WALL_HANG':
        this._updateWallHang(dt, input, level, particles, audio);
        break;
      case 'WALL_CLIMB':
        this._updateWallClimb(dt, level, particles, audio);
        break;
      case 'DASH':
        this._updateDash(dt, level, particles);
        break;
      case 'ROLL':
        this._updateRoll(dt, input, level, particles, audio);
        break;
      case 'SLIDE':
        this._updateSlide(dt, input, level, particles, audio);
        break;
      case 'ATTACK_1':
      case 'ATTACK_2':
      case 'CROUCH_ATTACK':
        this._updateAttack(dt, input, level, particles, audio);
        break;
      case 'WALL_SLIDE':
        this._updateWallSlide(dt, input, level, particles, audio);
        break;
      case 'CROUCH_TRANS':
      case 'CROUCH':
      case 'CROUCH_WALK':
        this._updateCrouch(dt, input, level, particles, audio);
        break;
      case 'TURN_AROUND':
        this._updateTurnAround(dt, input, level, particles, audio);
        break;
      default:
        this._updateLocomotion(dt, input, level, particles, audio);
        break;
    }

    // Advance sprite animation
    this.animator.update(dt);

    // Check interactive hazards & checkpoints (if alive)
    if (this.state !== 'DEATH') {
      this._checkCheckpoints(level, particles, audio);
      this._checkHazards(level, particles, audio);
    }

    // Safety floor clamp
    if (this.y > level.height + 64) {
      this.respawn(false);
    }
  }

  // ---- STATE HANDLERS ----

  _updateLocomotion(dt, input, level, particles, audio) {
    const moveX = input.moveX;

    // Allow standing up if needed
    this.h = STAND_H;

    // Check Dash trigger (ground or air)
    if (this._tryStartDash(input, particles, audio)) return;

    // Grounded actions
    if (this.onGround) {
      this.coyoteTimer = COYOTE_TIME;
      this.airDashReady = true;

      // Drop through one-way platform (Down + Jump)
      if (input.down && this.jumpBufferTimer > 0 && this.onOneWay) {
        this.jumpBufferTimer = 0;
        this.dropThroughTimer = 0.22;
        this.onGround = false;
        this.y += 2;
        this.vy = 40;
        this.state = 'FALL';
        this.animator.play('fall');
        return;
      }

      // Attack 1
      if (input.attackPressed) {
        this._startAttack('ATTACK_1', audio);
        return;
      }

      // Power Slide (Down + Roll/Slide OR dedicated Slide key C while moving)
      if ((input.down && input.rollPressed) || (input.slidePressed && Math.abs(this.vx) > 35)) {
        this._startSlide(particles, audio);
        return;
      }

      // Dodge Roll
      if (input.rollPressed) {
        this._startRoll(particles, audio);
        return;
      }

      // Enter Crouch
      if (input.down) {
        this.h = CROUCH_H;
        this.state = 'CROUCH_TRANS';
        this.animator.play('crouchTrans', true);
        return;
      }

      // Check Turnaround Skid when running fast and reversing direction
      if (moveX !== 0 && Math.sign(moveX) !== this.facing && Math.abs(this.vx) > 95) {
        this.turnVisualFacing = this.facing;
        this.facing = Math.sign(moveX);
        this.state = 'TURN_AROUND';
        this.animator.play('turnAround', true);
        particles.spawnDust(this.x, this.y, 6, this.turnVisualFacing * 28, '#c8cfde');
        audio.skid();
        return;
      }
    } else {
      // Mid-air attack! Let the knight slash in mid-air too!
      if (input.attackPressed) {
        this._startAttack('ATTACK_1', audio);
        return;
      }
    }

    // Jump (with coyote time + jump buffer)
    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this._performJump(particles, audio);
      return;
    }

    // Horizontal acceleration
    if (this.wallJumpLockTimer <= 0) {
      if (moveX !== 0) {
        const accel = this.onGround ? GROUND_ACCEL : AIR_ACCEL;
        this.vx = moveToward(this.vx, moveX * RUN_SPEED, accel * dt);
        this.facing = Math.sign(moveX);
      } else {
        const decel = this.onGround ? GROUND_DECEL : AIR_DECEL;
        this.vx = moveToward(this.vx, 0, decel * dt);
      }
    }

    // Variable jump height cut when releasing jump early while rising
    if (!input.jumpHeld && this.vy < -65) {
      this.vy *= Math.pow(JUMP_CUT_MULT, dt * 16);
    }

    // Gravity
    const grav = this.vy > 0 ? GRAVITY * FALL_GRAVITY_MULT : GRAVITY;
    this.vy = Math.min(MAX_FALL_SPEED, this.vy + grav * dt);

    const wasOnGround = this.onGround;
    const prevVy = this.vy;
    this._moveAndCollide(dt, level);

    // Landing impact feel
    if (!wasOnGround && this.onGround) {
      const heavy = prevVy > 250;
      this.scaleX = heavy ? 1.24 : 1.14;
      this.scaleY = heavy ? 0.78 : 0.88;
      particles.spawnLandDust(this.x, this.y, heavy);
      audio.land(heavy);
      if (heavy) this.pendingShake = 2.2;
    }

    // Check Ledge Grab & Wall Slide while airborne
    if (!this.onGround) {
      if (this._tryLedgeGrab(input, level, particles, audio)) return;

      if (this.wallDir !== 0 && this.vy > 15 && moveX === this.wallDir) {
        this.state = 'WALL_SLIDE';
        this.airDashReady = true;
        this.animator.play('wallSlide', true);
        return;
      }
    }

    // Pick locomotion animation
    if (this.onGround) {
      if (Math.abs(this.vx) > 12) {
        this.state = 'RUN';
        this.animator.play('run');
        // Footstep dust & SFX on stride contact frames
        if ((this.animator.frame === 2 || this.animator.frame === 7) && this.lastRunStepFrame !== this.animator.frame) {
          this.lastRunStepFrame = this.animator.frame;
          particles.spawnDust(this.x - this.facing * 4, this.y, 2, -this.facing * 14);
          audio.step();
        }
      } else {
        this.state = 'IDLE';
        this.animator.play('idle');
        this.lastRunStepFrame = -1;
      }
    } else {
      if (this.vy < -45) {
        this.state = 'JUMP';
        this.animator.play('jump');
      } else if (this.vy >= -45 && this.vy <= 55 && (this.animator.current === 'jump' || this.animator.current === 'jumpFall')) {
        this.state = 'JUMP_APEX';
        this.animator.play('jumpFall');
      } else {
        this.state = 'FALL';
        this.animator.play('fall');
      }
    }
  }

  _updateTurnAround(dt, input, level, particles, audio) {
    if (this._tryStartDash(input, particles, audio)) return;
    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this._performJump(particles, audio);
      return;
    }
    if (input.attackPressed) {
      this._startAttack('ATTACK_1', audio);
      return;
    }

    this.vx = moveToward(this.vx, this.facing * RUN_SPEED * 0.55, GROUND_DECEL * 1.15 * dt);
    this.vy = Math.min(MAX_FALL_SPEED, this.vy + GRAVITY * dt);
    this._moveAndCollide(dt, level);

    if (!this.onGround) {
      this.state = 'FALL';
      this.animator.play('fall');
      return;
    }

    if (this.animator.finished) {
      this.state = Math.abs(input.moveX) > 0 ? 'RUN' : 'IDLE';
      this.animator.play(this.state === 'RUN' ? 'run' : 'idle');
    }
  }

  _updateCrouch(dt, input, level, particles, audio) {
    this.h = CROUCH_H;
    this.coyoteTimer = this.onGround ? COYOTE_TIME : 0;

    // Power Slide from crouch!
    if (input.rollPressed || input.slidePressed) {
      if (input.moveX !== 0) this.facing = Math.sign(input.moveX);
      this._startSlide(particles, audio);
      return;
    }

    // Crouch Attack!
    if (input.attackPressed) {
      this._startAttack('CROUCH_ATTACK', audio);
      return;
    }

    // Drop through one-way platform
    if (this.jumpBufferTimer > 0 && this.onOneWay) {
      this.jumpBufferTimer = 0;
      this.dropThroughTimer = 0.22;
      this.onGround = false;
      this.h = STAND_H;
      this.y += 2;
      this.vy = 40;
      this.state = 'FALL';
      this.animator.play('fall');
      return;
    }

    // Jump out of crouch if ceiling allows
    if (this.jumpBufferTimer > 0 && this.onGround && this._canStandUp(level)) {
      this.h = STAND_H;
      this._performJump(particles, audio);
      return;
    }

    // Stand up if Down released and overhead clearance exists
    const mustStayCrouched = !this._canStandUp(level);
    if (!input.down && !mustStayCrouched) {
      this.h = STAND_H;
      this.state = 'IDLE';
      this.animator.play('idle');
      return;
    }

    // Crouch movement
    if (input.moveX !== 0) {
      this.facing = Math.sign(input.moveX);
      this.vx = moveToward(this.vx, input.moveX * CROUCH_SPEED, GROUND_ACCEL * dt);
    } else {
      this.vx = moveToward(this.vx, 0, GROUND_DECEL * dt);
    }

    this.vy = Math.min(MAX_FALL_SPEED, this.vy + GRAVITY * dt);
    this._moveAndCollide(dt, level);

    if (!this.onGround) {
      if (this._canStandUp(level)) this.h = STAND_H;
      this.state = 'FALL';
      this.animator.play('fall');
      return;
    }

    if (this.state === 'CROUCH_TRANS') {
      if (this.animator.finished) {
        this.state = Math.abs(this.vx) > 6 ? 'CROUCH_WALK' : 'CROUCH';
        this.animator.play(this.state === 'CROUCH_WALK' ? 'crouchWalk' : 'crouch');
      }
    } else if (Math.abs(this.vx) > 6) {
      this.state = 'CROUCH_WALK';
      this.animator.play('crouchWalk');
    } else {
      this.state = 'CROUCH';
      this.animator.play('crouch');
    }
  }

  _startSlide(particles, audio) {
    this.state = 'SLIDE';
    this.slidePhase = 'start';
    this.slideTimer = SLIDE_DURATION;
    this.h = CROUCH_H;
    this.vx = this.facing * SLIDE_SPEED;
    this.animator.play('slideStart', true);
    particles.spawnDust(this.x - this.facing * 6, this.y, 8, -this.facing * 40, '#d2d8e6');
    audio.slide();
  }

  _updateSlide(dt, input, level, particles, audio) {
    this.h = CROUCH_H;

    // Can jump-cancel slide if overhead space allows
    if (this.jumpBufferTimer > 0 && this.onGround && this._canStandUp(level)) {
      this.h = STAND_H;
      this._performJump(particles, audio);
      return;
    }

    this.vy = Math.min(MAX_FALL_SPEED, this.vy + GRAVITY * dt);

    if (this.slidePhase === 'start') {
      if (this.animator.finished) {
        this.slidePhase = 'loop';
        this.animator.play('slide', true);
      }
    } else if (this.slidePhase === 'loop') {
      this.slideTimer -= dt;
      this.vx = moveToward(this.vx, this.facing * 95, 360 * dt);
      if (Math.random() < dt * 28) {
        particles.spawnDust(this.x - this.facing * 8, this.y, 1, -this.facing * 26);
      }
      if (this.slideTimer <= 0 || Math.abs(this.vx) < 55) {
        this.slidePhase = 'end';
        this.animator.play('slideEnd', true);
      }
    } else {
      this.vx = moveToward(this.vx, 0, GROUND_DECEL * 1.1 * dt);
      if (this.animator.finished) {
        if (input.down || !this._canStandUp(level)) {
          this.state = 'CROUCH';
          this.animator.play('crouch', true);
        } else {
          this.h = STAND_H;
          this.state = 'IDLE';
          this.animator.play('idle', true);
        }
      }
    }

    this._moveAndCollide(dt, level);

    if (!this.onGround) {
      if (this._canStandUp(level)) this.h = STAND_H;
      this.state = 'FALL';
      this.animator.play('fall');
    }
  }

  _startRoll(particles, audio) {
    this.state = 'ROLL';
    this.h = CROUCH_H;
    this.vx = this.facing * ROLL_SPEED;
    this.rollDodgedHazard = false;
    this.afterimageTimer = 0;
    this.animator.play('roll', true);
    particles.spawnDust(this.x, this.y, 7, -this.facing * 30);
    audio.roll();
  }

  _updateRoll(dt, input, level, particles, audio) {
    this.h = CROUCH_H;
    // Speed tapers smoothly toward end of roll
    const progress = this.animator.frame / 11;
    const targetSpeed = progress < 0.65 ? ROLL_SPEED : ROLL_SPEED * 0.45;
    this.vx = this.facing * targetSpeed;
    this.vy = Math.min(MAX_FALL_SPEED, this.vy + GRAVITY * dt);

    this.afterimageTimer -= dt;
    if (this.afterimageTimer <= 0 && this.animator.frame >= 1 && this.animator.frame <= 8) {
      this.afterimageTimer = 0.055;
      particles.addAfterimage('roll', this.animator.frame, this.x, this.y, this.facing, '#e6b85c', 0.18);
    }

    this._moveAndCollide(dt, level);

    // Allow attack cancel near the end of roll
    if (input.attackPressed && this.animator.frame >= 8) {
      if (this._canStandUp(level)) {
        this.h = STAND_H;
        this._startAttack('ATTACK_1', audio);
      } else {
        this._startAttack('CROUCH_ATTACK', audio);
      }
      return;
    }

    if (this.animator.finished) {
      if (!this._canStandUp(level) || input.down) {
        this.state = 'CROUCH';
        this.animator.play('crouch');
      } else {
        this.h = STAND_H;
        this.state = this.onGround ? 'IDLE' : 'FALL';
        this.animator.play(this.onGround ? 'idle' : 'fall');
      }
    }
  }

  _tryStartDash(input, particles, audio) {
    if (!input.dashPressed) return false;
    if (this.dashCooldown > 0) return false;
    if (!this.onGround && !this.airDashReady) return false;

    if (input.moveX !== 0) this.facing = Math.sign(input.moveX);
    if (!this.onGround) this.airDashReady = false;

    this.state = 'DASH';
    this.dashTimer = DASH_DURATION;
    this.dashCooldown = DASH_COOLDOWN;
    this.afterimageTimer = 0;
    this.h = STAND_H;
    this.vx = this.facing * DASH_SPEED;
    this.vy = 0;
    this.scaleX = 1.2;
    this.scaleY = 0.85;
    this.pendingShake = 2.5;
    this.animator.play('dash', true);
    particles.spawnSparks(this.x - this.facing * 6, this.y - 16, 10, '#a8f0ff', '#3a9ee8', -this.facing);
    audio.dash();
    return true;
  }

  _updateDash(dt, level, particles) {
    this.dashTimer -= dt;
    this.vx = this.facing * DASH_SPEED;
    this.vy = 0;

    this.afterimageTimer -= dt;
    if (this.afterimageTimer <= 0) {
      this.afterimageTimer = 0.028;
      particles.addAfterimage('dash', this.animator.frame, this.x, this.y, this.facing, '#5ed4f0', 0.22);
    }

    this._moveAndCollide(dt, level);

    if (this.dashTimer <= 0 || this.wallDir === this.facing) {
      this.vx *= 0.48;
      this.state = this.onGround ? 'RUN' : 'FALL';
      this.animator.play(this.onGround ? 'run' : 'fall');
    }
  }

  _startAttack(type, audio) {
    this.state = type;
    this.comboQueued = false;
    this.attackHasHit = false;
    if (type === 'ATTACK_1') {
      this.h = STAND_H;
      this.vx = this.onGround ? this.facing * 62 : this.vx * 0.7;
      this.animator.play('attack1', true);
      audio.slash1();
    } else if (type === 'ATTACK_2') {
      this.h = STAND_H;
      this.vx = this.onGround ? this.facing * 92 : this.vx * 0.7;
      this.animator.play('attack2', true);
      audio.slash2();
    } else {
      this.h = CROUCH_H;
      this.vx = this.facing * 35;
      this.animator.play('crouchAttack', true);
      audio.crouchSlash();
    }
  }

  _updateAttack(dt, input, level, particles, audio) {
    // Queue 2nd hit during Attack 1
    if (this.state === 'ATTACK_1' && input.attackPressed && this.animator.frame >= 1) {
      this.comboQueued = true;
    }

    // Allow dash-canceling recovery frames for snappy feel
    if (this.animator.frame >= 2 && this._tryStartDash(input, particles, audio)) {
      return;
    }

    // Friction + gravity
    if (this.onGround) {
      this.vx = moveToward(this.vx, 0, GROUND_DECEL * 0.85 * dt);
    } else {
      this.vx = moveToward(this.vx, input.moveX * RUN_SPEED * 0.65, AIR_ACCEL * 0.5 * dt);
    }
    this.vy = Math.min(MAX_FALL_SPEED, this.vy + GRAVITY * dt);
    this._moveAndCollide(dt, level);

    // Compute active sword hitbox on strike frames
    const f = this.animator.frame;
    let heavy = false;
    if (this.state === 'ATTACK_1' && (f === 1 || f === 2)) {
      this.activeHitbox = {
        x: this.facing === 1 ? this.x + 2 : this.x - 46,
        y: this.y - 36,
        w: 44,
        h: 32,
      };
    } else if (this.state === 'ATTACK_2' && (f === 2 || f === 3)) {
      heavy = true;
      this.activeHitbox = {
        x: this.facing === 1 ? this.x - 4 : this.x - 48,
        y: this.y - 40,
        w: 52,
        h: 36,
      };
    } else if (this.state === 'CROUCH_ATTACK' && (f === 1 || f === 2)) {
      this.activeHitbox = {
        x: this.facing === 1 ? this.x + 2 : this.x - 42,
        y: this.y - 24,
        w: 40,
        h: 22,
      };
    }

    if (this.activeHitbox && !this.attackHasHit) {
      const hits = level.handlePlayerAttack(this.activeHitbox, this.facing, heavy, particles, audio);
      if (hits > 0) {
        this.attackHasHit = true;
        this.comboCount += hits;
        this.comboResetTimer = 2.6;
        this.pendingHitstop = heavy ? 0.055 : 0.032;
        this.pendingShake = heavy ? 4.2 : 2.2;
      }
    }

    // Chain into Attack 2 right as Attack 1 finishes!
    if (this.animator.finished) {
      if (this.state === 'ATTACK_1' && this.comboQueued) {
        if (input.moveX !== 0) this.facing = Math.sign(input.moveX);
        this._startAttack('ATTACK_2', audio);
        return;
      }

      if (this.state === 'CROUCH_ATTACK') {
        if (input.down || !this._canStandUp(level)) {
          this.state = 'CROUCH';
          this.animator.play('crouch');
        } else {
          this.h = STAND_H;
          this.state = 'IDLE';
          this.animator.play('idle');
        }
      } else {
        this.h = STAND_H;
        this.state = this.onGround ? 'IDLE' : 'FALL';
        this.animator.play(this.onGround ? 'idle' : 'fall');
      }
    }
  }

  _updateWallSlide(dt, input, level, particles, audio) {
    const wall = this.wallDir;
    this.airDashReady = true;

    // Wall Jump!
    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer = 0;
      this.facing = -wall;
      this.vx = -wall * WALL_JUMP_VX;
      this.vy = WALL_JUMP_VY;
      this.wallJumpLockTimer = WALL_JUMP_LOCK;
      this.scaleX = 0.82;
      this.scaleY = 1.22;
      this.state = 'JUMP';
      this.animator.play('jump', true);
      particles.spawnDust(this.x + wall * 6, this.y - 16, 8, -wall * 42, '#d5dceb');
      audio.wallJump();
      return;
    }

    // Air dash off wall
    if (this._tryStartDash(input, particles, audio)) return;

    // Controlled slide fall speed
    this.vy = Math.min(WALL_SLIDE_SPEED, this.vy + GRAVITY * 0.45 * dt);
    this.vx = wall * 18; // gentle press against wall to maintain contact

    if (Math.random() < dt * 18) {
      particles.spawnDust(this.x + wall * 7, this.y - 24, 1, -wall * 10, '#c6cedf');
    }

    this._moveAndCollide(dt, level);

    // Check ledge grab if sliding past a corner
    if (this._tryLedgeGrab(input, level, particles, audio)) return;

    if (this.onGround) {
      this.state = 'IDLE';
      this.animator.play('idle');
      return;
    }

    // Detach if wall ended or player presses away / down
    if (this.wallDir === 0 || input.moveX === -wall || input.down) {
      this.state = 'FALL';
      this.animator.play('fall');
    }
  }

  _tryLedgeGrab(input, level, particles, audio) {
    if (this.ledgeCooldown > 0 || input.down) return false;
    if (this.vy < -100) return false; // don't snap during fast initial upward launch

    const dir = this.facing;
    const sensorX = dir === 1 ? this.right + 3 : this.left - 3;
    const grabYMin = this.top - 2;
    const grabYMax = this.top + 14;

    for (const s of level.solids) {
      const canGrab = dir === 1 ? s.ledgeLeft : s.ledgeRight;
      if (!canGrab) continue;

      const edgeX = dir === 1 ? s.x : s.x + s.w;
      if (Math.abs(sensorX - edgeX) > 6) continue;
      if (s.y < grabYMin || s.y > grabYMax) continue;

      // Ensure standing space above the ledge is clear
      const standX = edgeX + dir * 10;
      if (this._overlapsSolid(standX - STAND_W / 2, s.y - STAND_H, STAND_W, STAND_H, level)) {
        continue;
      }

      // Snap cleanly into WALL_HANG!
      // In _WallHang.png, hand grips pixel (67, 47), pivot is (54.5, 80) -> delta (+12.5, -33)
      this.ledge = { x: edgeX, y: s.y, dir };
      this.facing = dir;
      this.x = edgeX - dir * 11;
      this.y = s.y + 33;
      this.vx = 0;
      this.vy = 0;
      this.airDashReady = true;
      this.state = 'WALL_HANG';
      this.animator.play('wallHang', true);
      particles.spawnDust(edgeX, s.y + 2, 5, -dir * 18, '#d4dbe8');
      audio.ledgeGrab();
      return true;
    }
    return false;
  }

  _updateWallHang(dt, input, level, particles, audio) {
    if (!this.ledge) {
      this.state = 'FALL';
      return;
    }
    this.vx = 0;
    this.vy = 0;

    // Kick away if holding opposite direction + Jump
    if (this.jumpBufferTimer > 0 && input.moveX === -this.ledge.dir) {
      this.jumpBufferTimer = 0;
      const away = -this.ledge.dir;
      this.facing = away;
      this.vx = away * WALL_JUMP_VX;
      this.vy = WALL_JUMP_VY;
      this.ledge = null;
      this.ledgeCooldown = 0.25;
      this.wallJumpLockTimer = WALL_JUMP_LOCK;
      this.state = 'JUMP';
      this.animator.play('jump', true);
      particles.spawnDust(this.x, this.y - 20, 6, away * 35);
      audio.wallJump();
      return;
    }

    // Mantle up onto ledge: Up, Jump, or moving toward ledge
    if (input.upPressed || this.jumpBufferTimer > 0 || input.moveX === this.ledge.dir) {
      this.jumpBufferTimer = 0;
      this.state = 'WALL_CLIMB';
      this.animator.play('wallClimb', true);
      audio.ledgeClimb();
      return;
    }

    // Drop off ledge
    if (input.down) {
      this.ledge = null;
      this.ledgeCooldown = 0.28;
      this.state = 'FALL';
      this.animator.play('fall', true);
    }
  }

  _updateWallClimb(dt, level, particles, audio) {
    this.vx = 0;
    this.vy = 0;

    if (this.animator.finished && this.ledge) {
      // Frame 6 of _WallClimb.png ends with feet at y = ledge.y and body ~10px onto platform
      this.x = this.ledge.x + this.ledge.dir * 10;
      this.y = this.ledge.y;
      this.ledge = null;
      this.onGround = true;
      this.state = 'IDLE';
      this.animator.play('idle', true);
      particles.spawnDust(this.x, this.y, 5, 0);
      audio.step();
    }
  }

  _updateHit(dt, level, particles) {
    this.hitTimer -= dt;
    this.vy = Math.min(MAX_FALL_SPEED, this.vy + GRAVITY * dt);
    this.vx = moveToward(this.vx, 0, 260 * dt);
    this._moveAndCollide(dt, level);

    if (this.hitTimer <= 0) {
      this.state = this.onGround ? 'IDLE' : 'FALL';
      this.animator.play(this.onGround ? 'idle' : 'fall');
    }
  }

  _updateDeath(dt, level, particles) {
    this.deathTimer -= dt;
    this.vy = Math.min(MAX_FALL_SPEED, this.vy + GRAVITY * dt);
    this.vx = moveToward(this.vx, 0, this.onGround ? 420 * dt : 90 * dt);
    this._moveAndCollide(dt, level);

    if (this.deathTimer <= 0) {
      this.respawn(true);
      particles.spawnSparks(this.x, this.y - 16, 14, '#ffdf85', '#f28a38', 0);
      particles.addText(this.x, this.top - 6, 'RESTORED', '#ffe18a', 0.9);
    }
  }

  _performJump(particles, audio) {
    this.jumpBufferTimer = 0;
    this.coyoteTimer = 0;
    this.onGround = false;
    this.vy = JUMP_VEL;
    this.scaleX = 0.84;
    this.scaleY = 1.2;
    this.state = 'JUMP';
    this.animator.play('jump', true);
    particles.spawnDust(this.x, this.y, 7, -this.vx * 0.15);
    audio.jump();
  }

  // ---- COLLISION RESOLUTION ----

  _moveAndCollide(dt, level) {
    const prevBottom = this.y;

    // 1. Horizontal movement
    this.x += this.vx * dt;
    this.wallDir = 0;

    for (const s of level.solids) {
      if (rectsOverlap(this.left, this.top, this.w, this.h, s.x, s.y, s.w, s.h)) {
        if (this.vx > 0) {
          this.x = s.x - this.w / 2;
          this.vx = 0;
          this.wallDir = 1;
        } else if (this.vx < 0) {
          this.x = s.x + s.w + this.w / 2;
          this.vx = 0;
          this.wallDir = -1;
        }
      }
    }

    // Wall proximity sensor (1px probe for sticky wall-slide detection)
    if (this.wallDir === 0) {
      if (this._overlapsSolid(this.right, this.top + 4, 1.5, this.h - 8, level)) {
        this.wallDir = 1;
      } else if (this._overlapsSolid(this.left - 1.5, this.top + 4, 1.5, this.h - 8, level)) {
        this.wallDir = -1;
      }
    }

    // 2. Vertical movement
    this.y += this.vy * dt;
    this.onGround = false;
    this.onOneWay = false;

    for (const s of level.solids) {
      if (rectsOverlap(this.left, this.top, this.w, this.h, s.x, s.y, s.w, s.h)) {
        if (this.vy >= 0) {
          this.y = s.y;
          this.vy = 0;
          this.onGround = true;
        } else if (this.vy < 0) {
          this.y = s.y + s.h + this.h;
          this.vy = 0;
        }
      }
    }

    // 3. One-way wooden platforms
    if (!this.onGround && this.vy >= 0 && this.dropThroughTimer <= 0) {
      for (const p of level.platforms) {
        if (this.right > p.x && this.left < p.x + p.w) {
          if (prevBottom <= p.y + 2 && this.y >= p.y) {
            this.y = p.y;
            this.vy = 0;
            this.onGround = true;
            this.onOneWay = true;
            break;
          }
        }
      }
    }
  }

  _overlapsSolid(x, y, w, h, level) {
    for (const s of level.solids) {
      if (rectsOverlap(x, y, w, h, s.x, s.y, s.w, s.h)) return true;
    }
    return false;
  }

  _canStandUp(level) {
    return !this._overlapsSolid(this.x - STAND_W / 2, this.y - STAND_H, STAND_W, STAND_H, level);
  }

  _checkCheckpoints(level, particles, audio) {
    for (const cp of level.checkpoints) {
      if (!cp.lit && Math.abs(this.x - cp.x) < 18 && Math.abs(this.y - cp.y) < 20) {
        cp.lit = true;
        this.spawnX = cp.x + 14;
        this.spawnY = cp.y;
        this.hp = this.maxHp;
        particles.spawnSparks(cp.x, cp.y - 12, 16, '#fff0ad', '#f07b32', 0);
        particles.addText(cp.x, cp.y - 30, 'CHECKPOINT LIT', '#ffdc7c', 1.2);
        audio.checkpoint();
      }
    }
  }

  _checkHazards(level, particles, audio) {
    for (const sp of level.spikes) {
      if (rectsOverlap(this.left + 2, this.top + 4, this.w - 4, this.h - 4, sp.x + 2, sp.y + 2, sp.w - 4, sp.h - 2)) {
        if (this.isInvulnerable) {
          if (this.state === 'ROLL' && !this.rollDodgedHazard) {
            this.rollDodgedHazard = true;
            particles.addText(this.x, this.top - 6, 'DODGE!', '#79e8a8', 0.75);
            particles.spawnSparks(this.x, this.y - 10, 6, '#a4ffd0', '#5ed4f0', this.facing);
          }
          continue;
        }
        const knockDir = this.x < sp.x + sp.w / 2 ? -1 : 1;
        this.triggerHurt(knockDir, particles, audio, 1);
        return;
      }
    }
  }

  // ---- RENDERING ----

  draw(ctx, sprites, debug = false) {
    // Blink during post-hit invulnerability
    if (this.invulnTimer > 0 && this.state !== 'HIT' && this.state !== 'DEATH') {
      if (Math.floor(this.invulnTimer * 18) % 2 === 0) {
        ctx.save();
        ctx.globalAlpha = 0.42;
        this._drawSprite(ctx, sprites);
        ctx.restore();
      } else {
        this._drawSprite(ctx, sprites);
      }
    } else {
      this._drawSprite(ctx, sprites);
    }

    if (debug) {
      this._drawDebug(ctx);
    }
  }

  _drawSprite(ctx, sprites) {
    let drawFacing = this.facing;
    let drawX = this.x;
    let drawY = this.y;
    let pivotX = PIVOT_X;
    let pivotY = PIVOT_Y;

    if (this.state === 'TURN_AROUND') {
      drawFacing = this.turnVisualFacing;
    } else if (this.state === 'WALL_SLIDE') {
      // _WallSlide.png shows knight pressed against a wall on his LEFT, facing RIGHT
      drawFacing = -this.wallDir;
      drawX = this.x + this.wallDir * 2;
    } else if ((this.state === 'WALL_HANG' || this.state === 'WALL_CLIMB') && this.ledge) {
      // Anchor hand pixel (67, 47) directly onto (ledge.x, ledge.y) for zero-jitter climb!
      drawFacing = this.ledge.dir;
      drawX = this.ledge.x;
      drawY = this.ledge.y;
      pivotX = 67;
      pivotY = 47;
    }

    // Subtle ground contact shadow
    if (this.onGround && this.state !== 'DEATH') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
      ctx.beginPath();
      ctx.ellipse(Math.round(this.x), Math.round(this.y), 9, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // White flash on fresh hit
    const tint = this.state === 'HIT' && this.hitTimer > 0.2 ? '#ffffff' : null;

    sprites.drawFrame(ctx, this.animator.current, this.animator.frame, drawX, drawY, drawFacing, {
      pivotX,
      pivotY,
      scaleX: this.scaleX,
      scaleY: this.scaleY,
      tint,
    });
  }

  _drawDebug(ctx) {
    ctx.save();
    // Physics AABB
    ctx.strokeStyle = this.isInvulnerable ? '#5ed4f0' : '#69db8a';
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(this.left) + 0.5, Math.round(this.top) + 0.5, this.w, this.h);

    // Pivot dot (bottom-center)
    ctx.fillStyle = '#ffe066';
    ctx.fillRect(Math.round(this.x) - 1, Math.round(this.y) - 1, 3, 3);

    // Active Sword Hitbox
    if (this.activeHitbox) {
      const hb = this.activeHitbox;
      ctx.fillStyle = 'rgba(255, 84, 98, 0.28)';
      ctx.fillRect(hb.x, hb.y, hb.w, hb.h);
      ctx.strokeStyle = '#ff5462';
      ctx.strokeRect(hb.x + 0.5, hb.y + 0.5, hb.w, hb.h);
    }

    // Ledge grab sensor box
    const sx = this.facing === 1 ? this.right : this.left - 5;
    ctx.strokeStyle = 'rgba(230, 184, 92, 0.7)';
    ctx.strokeRect(Math.round(sx) + 0.5, Math.round(this.top - 2) + 0.5, 5, 16);

    // Velocity vector
    ctx.strokeStyle = '#5ed4f0';
    ctx.beginPath();
    ctx.moveTo(this.x, this.y - this.h / 2);
    ctx.lineTo(this.x + this.vx * 0.12, this.y - this.h / 2 + this.vy * 0.12);
    ctx.stroke();

    // State + velocity readout
    ctx.font = 'bold 6px ui-monospace, Consolas, monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(`${this.state} (${Math.round(this.vx)},${Math.round(this.vy)})`, Math.round(this.x), Math.round(this.top) - 4);
    ctx.restore();
  }
}

function moveToward(cur, target, maxDelta) {
  if (Math.abs(target - cur) <= maxDelta) return target;
  return cur + Math.sign(target - cur) * maxDelta;
}
