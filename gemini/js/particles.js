// Pixel-art particle system, sprite afterimages, and floating combat/status text

export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.afterimages = [];
    this.texts = [];
    this.embers = [];
  }

  initAmbientEmbers(worldW, worldH, count = 48) {
    this.embers = [];
    for (let i = 0; i < count; i++) {
      this.embers.push({
        x: Math.random() * worldW,
        y: Math.random() * worldH,
        vx: -4 - Math.random() * 10,
        vy: -6 - Math.random() * 10,
        size: Math.random() < 0.7 ? 1 : 2,
        phase: Math.random() * Math.PI * 2,
        color: Math.random() < 0.65 ? '#f5b35d' : '#7ea8e8',
        alpha: 0.25 + Math.random() * 0.45,
      });
    }
  }

  addAfterimage(animKey, frame, x, y, facing, tint = '#5ed4f0', life = 0.22, opts = {}) {
    this.afterimages.push({
      animKey,
      frame,
      x,
      y,
      facing,
      tint,
      life,
      maxLife: life,
      pivotX: opts.pivotX,
      pivotY: opts.pivotY,
    });
  }

  addText(x, y, text, color = '#f5d47a', life = 0.75) {
    this.texts.push({
      x,
      y,
      vy: -24,
      text,
      color,
      life,
      maxLife: life,
    });
  }

  spawnDust(x, y, count = 5, vxBias = 0, color = '#b8bfd2') {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 6,
        y: y - Math.random() * 2,
        vx: vxBias + (Math.random() - 0.5) * 44,
        vy: -10 - Math.random() * 28,
        gravity: 40,
        size: Math.random() < 0.5 ? 2 : 3,
        color,
        life: 0.22 + Math.random() * 0.22,
        maxLife: 0.44,
        shrink: true,
      });
    }
  }

  spawnLandDust(x, y, heavy = false) {
    const n = heavy ? 12 : 7;
    for (let i = 0; i < n; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      this.particles.push({
        x: x + side * (2 + Math.random() * 4),
        y: y - 1,
        vx: side * (22 + Math.random() * (heavy ? 58 : 34)),
        vy: -8 - Math.random() * (heavy ? 32 : 16),
        gravity: 65,
        size: heavy ? 3 : 2,
        color: i % 3 === 0 ? '#d8deed' : '#9aa3b8',
        life: 0.22 + Math.random() * 0.2,
        maxLife: 0.42,
        shrink: true,
      });
    }
  }

  spawnSparks(x, y, count = 10, color1 = '#fff1b8', color2 = '#f08c42', dirX = 0) {
    for (let i = 0; i < count; i++) {
      const ang = (Math.random() - 0.5) * Math.PI * 1.4 + (dirX < 0 ? Math.PI : 0);
      const spd = 45 + Math.random() * 95;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 4,
        y: y + (Math.random() - 0.5) * 6,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 20,
        gravity: 210,
        size: Math.random() < 0.6 ? 2 : 1,
        color: i % 2 === 0 ? color1 : color2,
        life: 0.16 + Math.random() * 0.2,
        maxLife: 0.36,
        shrink: false,
      });
    }
  }

  spawnDebris(x, y, count = 12, colors = ['#9a6638', '#754925', '#c99357']) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 130,
        vy: -55 - Math.random() * 95,
        gravity: 340,
        size: 2 + Math.floor(Math.random() * 3),
        color: colors[i % colors.length],
        life: 0.45 + Math.random() * 0.45,
        maxLife: 0.9,
        shrink: false,
      });
    }
  }

  spawnTorchSpark(x, y) {
    if (Math.random() > 0.35) return;
    this.particles.push({
      x: x + (Math.random() - 0.5) * 4,
      y: y - 1,
      vx: (Math.random() - 0.5) * 12,
      vy: -16 - Math.random() * 20,
      gravity: -8,
      size: Math.random() < 0.7 ? 1 : 2,
      color: Math.random() < 0.5 ? '#ffcf6b' : '#f27238',
      life: 0.35 + Math.random() * 0.35,
      maxLife: 0.7,
      shrink: true,
    });
  }

  update(dt, worldW, worldH) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }

    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      const a = this.afterimages[i];
      a.life -= dt;
      if (a.life <= 0) this.afterimages.splice(i, 1);
    }

    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.texts.splice(i, 1);
        continue;
      }
      t.y += t.vy * dt;
      t.vy *= 0.93;
    }

    for (const e of this.embers) {
      e.phase += dt * 2;
      e.x += (e.vx + Math.sin(e.phase) * 5) * dt;
      e.y += e.vy * dt;
      if (e.x < 0) e.x += worldW;
      if (e.y < 0) e.y += worldH;
    }
  }

  drawAmbient(ctx, camX, camY, viewW, viewH) {
    for (const e of this.embers) {
      if (e.x < camX - 8 || e.x > camX + viewW + 8 || e.y < camY - 8 || e.y > camY + viewH + 8) continue;
      ctx.globalAlpha = e.alpha * (0.65 + 0.35 * Math.sin(e.phase * 1.7));
      ctx.fillStyle = e.color;
      ctx.fillRect(Math.round(e.x), Math.round(e.y), e.size, e.size);
    }
    ctx.globalAlpha = 1;
  }

  drawAfterimages(ctx, sprites) {
    for (const a of this.afterimages) {
      const t = Math.max(0, a.life / a.maxLife);
      sprites.drawFrame(ctx, a.animKey, a.frame, a.x, a.y, a.facing, {
        tint: a.tint,
        alpha: t * 0.52,
        pivotX: a.pivotX,
        pivotY: a.pivotY,
      });
    }
  }

  drawParticles(ctx) {
    for (const p of this.particles) {
      const t = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = Math.min(1, t * 1.4);
      ctx.fillStyle = p.color;
      const s = p.shrink ? Math.max(1, Math.round(p.size * t)) : p.size;
      ctx.fillRect(Math.round(p.x - s * 0.5), Math.round(p.y - s * 0.5), s, s);
    }
    ctx.globalAlpha = 1;
  }

  drawTexts(ctx) {
    ctx.save();
    ctx.font = 'bold 8px ui-monospace, Consolas, monospace';
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      const alpha = Math.min(1, (t.life / t.maxLife) * 1.6);
      ctx.globalAlpha = alpha;
      const rx = Math.round(t.x);
      const ry = Math.round(t.y);
      ctx.fillStyle = '#090b10';
      ctx.fillText(t.text, rx + 1, ry + 1);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, rx, ry);
    }
    ctx.restore();
  }
}
