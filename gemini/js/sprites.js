// Sprite loader and animation manager for the 120x80 Pixel Knight spritesheets

export const FRAME_W = 120;
export const FRAME_H = 80;
export const PIVOT_X = 54.5; // Horizontal center of the knight's stance inside the 120px frame
export const PIVOT_Y = 80;   // Feet rest on row 79 (bottom of 80px canvas)

export const ANIM_DEFS = {
  idle:            { file: '_Idle.png',                frames: 10, fps: 10, loop: true  },
  run:             { file: '_Run.png',                 frames: 10, fps: 14, loop: true  },
  turnAround:      { file: '_TurnAround.png',          frames: 3,  fps: 16, loop: false },
  jump:            { file: '_Jump.png',                frames: 3,  fps: 12, loop: true  },
  jumpFall:        { file: '_JumpFallInbetween.png',   frames: 2,  fps: 12, loop: false },
  fall:            { file: '_Fall.png',                frames: 3,  fps: 12, loop: true  },
  crouchTrans:     { file: '_CrouchTransition.png',    frames: 1,  fps: 18, loop: false },
  crouch:          { file: '_Crouch.png',              frames: 1,  fps: 8,  loop: true  },
  crouchWalk:      { file: '_CrouchWalk.png',          frames: 8,  fps: 10, loop: true  },
  crouchAttack:    { file: '_CrouchAttack.png',        frames: 4,  fps: 15, loop: false },
  slideStart:      { file: '_SlideTransitionStart.png',frames: 1,  fps: 18, loop: false },
  slide:           { file: '_Slide.png',               frames: 2,  fps: 12, loop: true  },
  slideEnd:        { file: '_SlideTransitionEnd.png',  frames: 1,  fps: 16, loop: false },
  roll:            { file: '_Roll.png',                frames: 12, fps: 22, loop: false },
  dash:            { file: '_Dash.png',                frames: 2,  fps: 14, loop: true  },
  attack1:         { file: '_AttackNoMovement.png',    frames: 4,  fps: 16, loop: false },
  attack2:         { file: '_Attack2NoMovement.png',   frames: 6,  fps: 16, loop: false },
  wallSlide:       { file: '_WallSlide.png',           frames: 3,  fps: 10, loop: true  },
  wallHang:        { file: '_WallHang.png',            frames: 1,  fps: 8,  loop: true  },
  wallClimb:       { file: '_WallClimb.png',           frames: 7,  fps: 16, loop: false },
  hit:             { file: '_Hit.png',                 frames: 1,  fps: 10, loop: false },
  death:           { file: '_DeathNoMovement.png',     frames: 10, fps: 12, loop: false },
};

export class SpriteBank {
  constructor(basePath = './120x80_PNGSheets/') {
    this.basePath = basePath;
    this.images = {};
    this.tintedCache = new Map();
  }

  async loadAll(onProgress) {
    const keys = Object.keys(ANIM_DEFS);
    let loaded = 0;

    await Promise.all(
      keys.map(
        (key) =>
          new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              this.images[key] = img;
              loaded++;
              if (onProgress) onProgress(loaded, keys.length, ANIM_DEFS[key].file);
              resolve();
            };
            img.onerror = () => reject(new Error(`Failed to load ${this.basePath}${ANIM_DEFS[key].file}`));
            img.src = `${this.basePath}${ANIM_DEFS[key].file}`;
          })
      )
    );
  }

  // Returns an offscreen canvas with a solid-color silhouette of the spritesheet for dash/roll ghosts
  getTintedSheet(key, color) {
    const cacheKey = `${key}_${color}`;
    if (this.tintedCache.has(cacheKey)) return this.tintedCache.get(cacheKey);
    const src = this.images[key];
    if (!src) return null;

    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);

    this.tintedCache.set(cacheKey, c);
    return c;
  }

  drawFrame(ctx, key, frameIndex, worldX, worldY, facing = 1, options = {}) {
    const img = options.tint ? this.getTintedSheet(key, options.tint) : this.images[key];
    if (!img) return;
    const def = ANIM_DEFS[key];
    const fi = Math.max(0, Math.min(def.frames - 1, Math.floor(frameIndex)));
    const sx = fi * FRAME_W;

    const pivotX = options.pivotX ?? PIVOT_X;
    const pivotY = options.pivotY ?? PIVOT_Y;
    const alpha = options.alpha ?? 1;
    const scaleX = options.scaleX ?? 1;
    const scaleY = options.scaleY ?? 1;

    ctx.save();
    if (alpha < 1) ctx.globalAlpha = alpha;
    ctx.translate(Math.round(worldX), Math.round(worldY));
    ctx.scale(facing * scaleX, scaleY);
    ctx.drawImage(
      img,
      sx, 0, FRAME_W, FRAME_H,
      Math.round(-pivotX), Math.round(-pivotY), FRAME_W, FRAME_H
    );
    ctx.restore();
  }
}

export class Animator {
  constructor() {
    this.current = 'idle';
    this.frame = 0;
    this.timer = 0;
    this.finished = false;
  }

  play(name, resetIfSame = false) {
    if (this.current === name && !resetIfSame) return;
    this.current = name;
    this.frame = 0;
    this.timer = 0;
    this.finished = false;
  }

  update(dt) {
    const def = ANIM_DEFS[this.current];
    if (!def) return;
    if (this.finished && !def.loop) return;

    const frameDur = 1 / def.fps;
    this.timer += dt;
    while (this.timer >= frameDur) {
      this.timer -= frameDur;
      if (this.frame + 1 < def.frames) {
        this.frame++;
      } else if (def.loop) {
        this.frame = 0;
      } else {
        this.finished = true;
        break;
      }
    }
  }

  get label() {
    const def = ANIM_DEFS[this.current];
    if (!def) return '';
    const base = def.file.replace('.png', '');
    return `${base} [${this.frame + 1}/${def.frames}]`;
  }
}
