// Citadel Proving Grounds — multi-zone sidescrolling demo level & pixel-art renderer

export const WORLD_W = 2240;
export const WORLD_H = 360;

export class Level {
  constructor() {
    this.width = WORLD_W;
    this.height = WORLD_H;
    this.time = 0;

    // Solid rectangular terrain blocks: { x, y, w, h, style, ledgeLeft, ledgeRight }
    this.solids = [
      // Outer boundary walls
      { x: 0, y: 0, w: 32, h: 360, style: 'wall' },
      { x: 2208, y: 0, w: 32, h: 360, style: 'wall' },

      // Zone 1 & 2 & 3 main ground floor (x: 32..1424)
      { x: 32, y: 272, w: 1392, h: 88, style: 'ground' },

      // Zone 1: Warm-up plinths & ledge-grab step
      { x: 432, y: 240, w: 48, h: 32, style: 'stone', ledgeLeft: true, ledgeRight: true },
      { x: 496, y: 208, w: 48, h: 64, style: 'stone', ledgeLeft: true, ledgeRight: true },

      // Zone 2: Low Vault Tunnels (clearance = 272 - 246 = 26px; standing=34px, crouch/slide=20px)
      { x: 608, y: 214, w: 96, h: 32, style: 'arch', ledgeLeft: true, ledgeRight: true },
      { x: 768, y: 214, w: 80, h: 32, style: 'arch', ledgeLeft: true, ledgeRight: true },

      // Zone 3: Wall-Jump Chimney (inner gap 1040..1120 = 80px wide)
      // Left wall has a 48px high archway underneath (224..272) to enter freely
      { x: 1008, y: 112, w: 32, h: 112, style: 'tower', ledgeLeft: true, ledgeRight: true },
      // Right chimney wall goes all the way to ground
      { x: 1120, y: 112, w: 32, h: 160, style: 'tower', ledgeLeft: true, ledgeRight: true },
      // High bridge connecting chimney summit to ledge-climb tower
      { x: 1152, y: 128, w: 160, h: 20, style: 'stone', ledgeLeft: false, ledgeRight: true },

      // Ledge-climb practice steps on right side of tower (48px vertical steps)
      { x: 1232, y: 224, w: 56, h: 48, style: 'stone', ledgeLeft: true, ledgeRight: true },
      { x: 1296, y: 176, w: 56, h: 96, style: 'stone', ledgeLeft: true, ledgeRight: true },

      // Zone 4: Shadow-Dash Chasm
      // Deep chasm safety floor with spikes in center and climb-out walls
      { x: 1424, y: 328, w: 336, h: 32, style: 'ground' },
      // Floating stone islands for Jump + Air-Dash
      { x: 1516, y: 248, w: 68, h: 22, style: 'stone', ledgeLeft: true, ledgeRight: true },
      { x: 1668, y: 220, w: 72, h: 22, style: 'stone', ledgeLeft: true, ledgeRight: true },
      // Watchtower Bell Platform
      { x: 1684, y: 156, w: 76, h: 16, style: 'stone', ledgeLeft: true, ledgeRight: true },

      // Zone 5: Hazard Alcove & Final Range
      { x: 1760, y: 272, w: 448, h: 88, style: 'ground', ledgeLeft: true },
      // Raised platform overlooking spike trial
      { x: 1896, y: 212, w: 80, h: 16, style: 'stone', ledgeLeft: true, ledgeRight: true },
    ];

    // One-way wooden platforms (jump up through, press Down+Jump to drop through)
    this.platforms = [
      { x: 196, y: 224, w: 112 },
      { x: 556, y: 240, w: 48 },
      { x: 708, y: 214, w: 56 },
      { x: 960, y: 180, w: 48 },
      { x: 1440, y: 296, w: 44 }, // Chasm recovery step left
      { x: 1708, y: 296, w: 44 }, // Chasm recovery step right
      { x: 1608, y: 188, w: 52 }, // Step up to bell tower
    ];

    // Floor spikes: { x, y, w, h }
    this.spikes = [
      { x: 1512, y: 320, w: 160, h: 8 }, // Bottom of chasm
      { x: 1844, y: 264, w: 44, h: 8 },  // Roll i-frame test 1
      { x: 1984, y: 264, w: 44, h: 8 },  // Roll i-frame test 2
    ];

    // Checkpoints (bonfires)
    this.checkpoints = [
      { id: 0, x: 76,   y: 272, lit: true  },
      { id: 1, x: 944,  y: 272, lit: false },
      { id: 2, x: 1392, y: 272, lit: false },
      { id: 3, x: 1796, y: 272, lit: false },
    ];

    // Zones for diegetic HUD banners
    this.zones = [
      { x0: 0,    x1: 540,  title: 'COURTYARD PROVING GROUNDS', sub: 'Run · Turn Skid · Jump · 2-Hit Combo' },
      { x0: 540,  x1: 910,  title: 'THE LOW VAULTS',            sub: 'Crouch Walk · Crouch Attack · Power Slide' },
      { x0: 910,  x1: 1380, title: 'CHIMNEY & BATTLEMENT TOWER',sub: 'Wall Slide · Wall Jump · Ledge Hang & Climb' },
      { x0: 1380, x1: 1760, title: 'SHADOW-DASH CHASM',         sub: 'Air Dash · Watchtower Bell' },
      { x0: 1760, x1: 2240, title: 'SPIKE GAUNTLET',            sub: 'Dodge Roll i-Frames · Hit & Death Showcase' },
    ];

    // Decorative torches, banners, and carved stone signposts
    this.torches = [
      { x: 128, y: 236 }, { x: 352, y: 236 }, { x: 588, y: 236 },
      { x: 736, y: 236 }, { x: 988, y: 236 }, { x: 1080, y: 152 },
      { x: 1200, y: 96 }, { x: 1368, y: 236 }, { x: 1550, y: 218 },
      { x: 1722, y: 124 }, { x: 1824, y: 236 }, { x: 2072, y: 236 },
    ];

    this.banners = [
      { x: 166, y: 202, h: 36, color: '#9c2c3a' },
      { x: 318, y: 202, h: 36, color: '#9c2c3a' },
      { x: 1080, y: 112, h: 38, color: '#2e5d8c' },
      { x: 1228, y: 74, h: 34, color: '#9c2c3a' },
      { x: 2144, y: 198, h: 42, color: '#c48f31' },
    ];

    this.signs = [
      { x: 162, y: 272, label: 'COMBO: J J' },
      { x: 580, y: 272, label: 'SLIDE: S+K' },
      { x: 1080, y: 272, label: 'WALL JUMP' },
      { x: 1410, y: 272, label: 'AIR DASH: L' },
      { x: 1824, y: 272, label: 'ROLL: K' },
    ];

    // Citadel Bell at top of watchtower
    this.bell = { x: 1722, y: 118, swing: 0, swingVel: 0, glow: 0 };

    // Interactive props: training dummies and breakable crates
    this.dummies = [];
    this.crates = [];
    this.resetProps();

    // Background parallax structures (deterministic)
    this.bgSpires = [];
    for (let i = 0; i < 24; i++) {
      this.bgSpires.push({
        x: i * 95 + ((i * 37) % 30),
        w: 36 + ((i * 23) % 44),
        h: 70 + ((i * 53) % 95),
        pointed: i % 3 === 0,
        windows: i % 2 === 0,
      });
    }
    this.stars = [];
    for (let i = 0; i < 65; i++) {
      this.stars.push({
        x: (i * 197 + 41) % 480,
        y: (i * 89 + 13) % 135,
        phase: i * 1.1,
        bright: i % 4 === 0,
      });
    }
  }

  resetProps() {
    this.dummies = [
      { x: 248, y: 272, tilt: 0, tiltVel: 0, flash: 0, low: false, hits: 0 },
      { x: 312, y: 272, tilt: 0, tiltVel: 0, flash: 0, low: false, hits: 0 },
      { x: 736, y: 272, tilt: 0, tiltVel: 0, flash: 0, low: true,  hits: 0 },
      { x: 1252, y: 128, tilt: 0, tiltVel: 0, flash: 0, low: false, hits: 0 },
      { x: 2108, y: 272, tilt: 0, tiltVel: 0, flash: 0, low: false, hits: 0 },
    ];

    this.crates = [
      this._makeCrate(364, 256),
      this._makeCrate(384, 256),
      this._makeCrate(374, 240),
      this._makeCrate(876, 256),
      this._makeCrate(1208, 112),
      this._makeCrate(2154, 256),
      this._makeCrate(2172, 256),
    ];
  }

  _makeCrate(x, y) {
    return { x, y, w: 16, h: 16, alive: true, respawnTimer: 0 };
  }

  getZoneAt(x) {
    for (const z of this.zones) {
      if (x >= z.x0 && x < z.x1) return z;
    }
    return this.zones[0];
  }

  update(dt, particles) {
    this.time += dt;

    // Dummy spring physics
    for (const d of this.dummies) {
      if (d.flash > 0) d.flash = Math.max(0, d.flash - dt);
      const spring = -130 * d.tilt - 10 * d.tiltVel;
      d.tiltVel += spring * dt;
      d.tilt += d.tiltVel * dt;
    }

    // Crate respawn after 6s so players can smash endlessly
    for (const c of this.crates) {
      if (!c.alive) {
        c.respawnTimer -= dt;
        if (c.respawnTimer <= 0) {
          c.alive = true;
          particles.spawnDust(c.x + c.w / 2, c.y + c.h, 6, 0, '#d8c29c');
        }
      }
    }

    // Bell pendulum physics
    const b = this.bell;
    if (b.glow > 0) b.glow = Math.max(0, b.glow - dt);
    const bAcc = -42 * b.swing - 2.4 * b.swingVel;
    b.swingVel += bAcc * dt;
    b.swing += b.swingVel * dt;

    // Torch sparks
    for (const t of this.torches) {
      if (Math.random() < dt * 8) {
        particles.spawnTorchSpark(t.x, t.y - 4);
      }
    }
    for (const cp of this.checkpoints) {
      if (cp.lit && Math.random() < dt * 10) {
        particles.spawnTorchSpark(cp.x, cp.y - 12);
      }
    }
  }

  // Check sword hitbox against dummies, crates, and bell
  handlePlayerAttack(hitbox, facing, heavy, particles, audio) {
    let hitCount = 0;

    for (const d of this.dummies) {
      const dx = d.x - 9;
      const dy = d.low ? d.y - 22 : d.y - 34;
      const dw = 18;
      const dh = d.low ? 22 : 34;
      if (rectsOverlap(hitbox.x, hitbox.y, hitbox.w, hitbox.h, dx, dy, dw, dh)) {
        d.tiltVel = facing * (heavy ? 11.5 : 7.8);
        d.flash = 0.14;
        d.hits++;
        hitCount++;
        const dmg = heavy ? 35 : 20;
        particles.spawnSparks(d.x, dy + dh * 0.45, heavy ? 14 : 9, '#fff2bd', '#e89d41', facing);
        particles.spawnDebris(d.x, dy + dh * 0.4, 5, ['#d6b35a', '#b58d38', '#f0d88b']);
        particles.addText(d.x, dy - 4, `${dmg}${heavy ? '!' : ''}`, heavy ? '#ffcf6b' : '#f0f4ff', 0.65);
        audio.hitTarget(heavy);
      }
    }

    for (const c of this.crates) {
      if (!c.alive) continue;
      if (rectsOverlap(hitbox.x, hitbox.y, hitbox.w, hitbox.h, c.x, c.y, c.w, c.h)) {
        c.alive = false;
        c.respawnTimer = 6.5;
        hitCount++;
        particles.spawnDebris(c.x + 8, c.y + 8, 14, ['#a8703b', '#7a4b24', '#d9a462', '#4f3018']);
        particles.spawnSparks(c.x + 8, c.y + 8, 8, '#fff0c4', '#e08b3b', facing);
        audio.crateBreak();
      }
    }

    // Check watchtower bell
    const b = this.bell;
    if (rectsOverlap(hitbox.x, hitbox.y, hitbox.w, hitbox.h, b.x - 10, b.y - 6, 20, 22)) {
      b.swingVel = facing * 9.5;
      b.glow = 1.0;
      hitCount++;
      particles.spawnSparks(b.x, b.y + 6, 18, '#fff7c2', '#f2bd41', facing);
      particles.addText(b.x, b.y - 12, 'CLANG!', '#ffe078', 1.1);
      audio.bell();
    }

    return hitCount;
  }

  // ---- RENDERING ----

  drawBackground(ctx, camX, camY, viewW, viewH) {
    // Twilight gradient sky
    const grad = ctx.createLinearGradient(0, 0, 0, viewH);
    grad.addColorStop(0, '#0d1221');
    grad.addColorStop(0.55, '#1a233a');
    grad.addColorStop(1, '#25283d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, viewW, viewH);

    // Twinkling stars
    for (const s of this.stars) {
      const a = 0.35 + 0.45 * Math.sin(this.time * 2.2 + s.phase);
      ctx.globalAlpha = a;
      ctx.fillStyle = s.bright ? '#dbe8ff' : '#8fa6cc';
      const sx = ((s.x - camX * 0.04) % viewW + viewW) % viewW;
      ctx.fillRect(Math.round(sx), s.y, s.bright ? 2 : 1, 1);
    }
    ctx.globalAlpha = 1;

    // Moon with subtle halo
    const moonX = Math.round(372 - camX * 0.03);
    const moonY = Math.round(52 - camY * 0.03);
    const halo = ctx.createRadialGradient(moonX, moonY, 8, moonX, moonY, 54);
    halo.addColorStop(0, 'rgba(210, 226, 255, 0.22)');
    halo.addColorStop(1, 'rgba(210, 226, 255, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(moonX - 54, moonY - 54, 108, 108);

    ctx.fillStyle = '#dde7fa';
    ctx.beginPath();
    ctx.arc(moonX, moonY, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c4d2eb';
    ctx.fillRect(moonX - 6, moonY - 5, 4, 3);
    ctx.fillRect(moonX + 3, moonY + 2, 5, 4);

    // Distant mountain ridge (parallax 0.12)
    ctx.fillStyle = '#141a2b';
    ctx.beginPath();
    ctx.moveTo(0, viewH);
    for (let sx = -40; sx <= viewW + 40; sx += 24) {
      const wx = sx + camX * 0.12;
      const h = 88 + Math.sin(wx * 0.011) * 26 + Math.cos(wx * 0.025) * 14;
      ctx.lineTo(sx, viewH - h);
    }
    ctx.lineTo(viewW, viewH);
    ctx.closePath();
    ctx.fill();

    // Far citadel silhouettes (parallax 0.25)
    const paraX = camX * 0.25;
    for (const sp of this.bgSpires) {
      const sx = Math.round(sp.x - paraX);
      if (sx + sp.w < -20 || sx > viewW + 20) continue;
      const baseY = viewH - 22;
      const topY = baseY - sp.h;
      ctx.fillStyle = '#192033';
      ctx.fillRect(sx, topY, sp.w, sp.h + 40);

      // Crenellations or spire roof
      if (sp.pointed) {
        ctx.beginPath();
        ctx.moveTo(sx - 3, topY);
        ctx.lineTo(sx + sp.w / 2, topY - 24);
        ctx.lineTo(sx + sp.w + 3, topY);
        ctx.closePath();
        ctx.fill();
      } else {
        for (let bx = 0; bx < sp.w; bx += 8) {
          ctx.fillRect(sx + bx, topY - 5, 5, 5);
        }
      }

      // Warm distant lit slits
      if (sp.windows) {
        ctx.fillStyle = 'rgba(235, 180, 92, 0.32)';
        ctx.fillRect(sx + Math.floor(sp.w / 2) - 2, topY + 14, 3, 7);
        ctx.fillRect(sx + Math.floor(sp.w / 2) - 2, topY + 32, 3, 7);
      }
    }

    // Midground gothic colonnade arches (parallax 0.45)
    const archSpacing = 96;
    const archStart = Math.floor((camX * 0.45) / archSpacing) * archSpacing;
    ctx.fillStyle = '#1e2436';
    for (let ax = archStart - archSpacing; ax < camX * 0.45 + viewW + archSpacing; ax += archSpacing) {
      const sx = Math.round(ax - camX * 0.45);
      // Pillar
      ctx.fillRect(sx, 78, 16, viewH);
      // Connecting arch top
      ctx.fillRect(sx, 74, archSpacing, 14);
      ctx.fillStyle = '#252c42';
      ctx.fillRect(sx + 2, 78, 3, viewH);
      ctx.fillStyle = '#1e2436';
    }
  }

  drawWorldBehindPlayer(ctx, camX, camY, viewW, viewH) {
    // Wall-mounted banners
    for (const b of this.banners) {
      if (b.x < camX - 24 || b.x > camX + viewW + 24) continue;
      const sway = Math.sin(this.time * 3.1 + b.x * 0.05) * 2;
      ctx.fillStyle = '#5c5552';
      ctx.fillRect(b.x - 10, b.y - 2, 20, 3);
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.moveTo(b.x - 8, b.y + 1);
      ctx.lineTo(b.x + 8, b.y + 1);
      ctx.lineTo(b.x + 8 + sway, b.y + b.h - 6);
      ctx.lineTo(b.x + sway, b.y + b.h);
      ctx.lineTo(b.x - 8 + sway, b.y + b.h - 6);
      ctx.closePath();
      ctx.fill();
      // Gold trim emblem
      ctx.fillStyle = '#dfb55c';
      ctx.fillRect(Math.round(b.x - 2 + sway * 0.3), b.y + 8, 4, 10);
      ctx.fillRect(Math.round(b.x - 4 + sway * 0.3), b.y + 11, 8, 3);
    }

    // Carved wooden signposts
    for (const s of this.signs) {
      if (s.x < camX - 40 || s.x > camX + viewW + 40) continue;
      ctx.fillStyle = '#573b24';
      ctx.fillRect(s.x - 2, s.y - 20, 4, 20);
      ctx.fillStyle = '#785233';
      ctx.fillRect(s.x - 24, s.y - 31, 48, 12);
      ctx.strokeStyle = '#3b2514';
      ctx.lineWidth = 1;
      ctx.strokeRect(s.x - 23.5, s.y - 30.5, 47, 11);
      ctx.fillStyle = '#ebd7b0';
      ctx.font = 'bold 6px ui-monospace, Consolas, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(s.label, s.x, s.y - 23);
    }

    // Torches
    for (const t of this.torches) {
      if (t.x < camX - 40 || t.x > camX + viewW + 40) continue;
      this._drawTorch(ctx, t.x, t.y);
    }

    // Checkpoints (Bonfires)
    for (const cp of this.checkpoints) {
      if (cp.x < camX - 40 || cp.x > camX + viewW + 40) continue;
      this._drawCheckpoint(ctx, cp);
    }

    // Solid terrain blocks
    for (const s of this.solids) {
      if (s.x + s.w < camX - 8 || s.x > camX + viewW + 8 || s.y + s.h < camY - 8 || s.y > camY + viewH + 8) {
        continue;
      }
      this._drawSolidBlock(ctx, s);
    }

    // One-way wooden platforms
    for (const p of this.platforms) {
      if (p.x + p.w < camX - 8 || p.x > camX + viewW + 8) continue;
      this._drawOneWayPlatform(ctx, p);
    }

    // Floor Spikes
    for (const sp of this.spikes) {
      if (sp.x + sp.w < camX - 8 || sp.x > camX + viewW + 8) continue;
      this._drawSpikes(ctx, sp);
    }

    // Training Dummies
    for (const d of this.dummies) {
      if (d.x < camX - 30 || d.x > camX + viewW + 30) continue;
      this._drawDummy(ctx, d);
    }

    // Breakable Crates
    for (const c of this.crates) {
      if (!c.alive) continue;
      if (c.x + c.w < camX - 8 || c.x > camX + viewW + 8) continue;
      this._drawCrate(ctx, c);
    }

    // Watchtower Bell
    this._drawBell(ctx);
  }

  _drawSolidBlock(ctx, s) {
    // Base dark masonry fill
    ctx.fillStyle = s.style === 'tower' ? '#2c3142' : '#2a2f3e';
    ctx.fillRect(s.x, s.y, s.w, s.h);

    // Brick course grid
    const brickH = 8;
    const brickW = 16;
    ctx.fillStyle = '#222634';
    for (let y = s.y; y < s.y + s.h; y += brickH) {
      ctx.fillRect(s.x, y, s.w, 1);
      const rowOffset = ((Math.floor((y - s.y) / brickH)) % 2) * 8;
      for (let x = s.x + rowOffset; x < s.x + s.w; x += brickW) {
        ctx.fillRect(x, y, 1, Math.min(brickH, s.y + s.h - y));
      }
    }

    // Subtle stone highlights on alternating bricks
    ctx.fillStyle = 'rgba(175, 192, 224, 0.08)';
    for (let y = s.y + 1; y < s.y + s.h - 2; y += brickH) {
      const row = Math.floor((y - s.y) / brickH);
      for (let x = s.x + (row % 2) * 8 + 1; x < s.x + s.w - 3; x += brickW * 2) {
        ctx.fillRect(x, y, Math.min(12, s.x + s.w - x - 1), 2);
      }
    }

    // Top stone cap + subtle moss trim
    if (s.style !== 'wall') {
      ctx.fillStyle = '#535e78';
      ctx.fillRect(s.x, s.y, s.w, 3);
      ctx.fillStyle = '#7582a1';
      ctx.fillRect(s.x, s.y, s.w, 1);
      // Subtle moss tufts along top edge
      ctx.fillStyle = '#3e6e58';
      for (let mx = s.x + 6; mx < s.x + s.w - 8; mx += 22) {
        ctx.fillRect(mx, s.y + 1, 6, 2);
        ctx.fillRect(mx + 2, s.y + 3, 3, 1);
      }
    }

    // Grab-able ledge corner brass/gold stone brackets (visual affordance!)
    ctx.fillStyle = '#d4aa59';
    if (s.ledgeLeft) {
      ctx.fillRect(s.x, s.y, 4, 2);
      ctx.fillRect(s.x, s.y, 2, 5);
    }
    if (s.ledgeRight) {
      ctx.fillRect(s.x + s.w - 4, s.y, 4, 2);
      ctx.fillRect(s.x + s.w - 2, s.y, 2, 5);
    }

    // Crisp outer dark border
    ctx.strokeStyle = '#12151f';
    ctx.lineWidth = 1;
    ctx.strokeRect(s.x + 0.5, s.y + 0.5, s.w - 1, s.h - 1);
  }

  _drawOneWayPlatform(ctx, p) {
    // Timber deck with iron brackets
    ctx.fillStyle = '#6e4a2e';
    ctx.fillRect(p.x, p.y, p.w, 5);
    ctx.fillStyle = '#996a43';
    ctx.fillRect(p.x, p.y, p.w, 2);
    ctx.fillStyle = '#3d2716';
    ctx.fillRect(p.x, p.y + 5, p.w, 1);
    for (let x = p.x + 8; x < p.x + p.w - 4; x += 14) {
      ctx.fillRect(x, p.y, 1, 5);
    }
    // Support brackets
    ctx.fillStyle = '#4c556b';
    ctx.fillRect(p.x + 3, p.y + 5, 3, 5);
    ctx.fillRect(p.x + p.w - 6, p.y + 5, 3, 5);
  }

  _drawSpikes(ctx, sp) {
    const spikeW = 8;
    const count = Math.floor(sp.w / spikeW);
    for (let i = 0; i < count; i++) {
      const sx = sp.x + i * spikeW;
      ctx.fillStyle = '#77839c';
      ctx.beginPath();
      ctx.moveTo(sx, sp.y + sp.h);
      ctx.lineTo(sx + spikeW / 2, sp.y);
      ctx.lineTo(sx + spikeW, sp.y + sp.h);
      ctx.closePath();
      ctx.fill();

      // Highlight edge
      ctx.fillStyle = '#d3dff5';
      ctx.beginPath();
      ctx.moveTo(sx + 1, sp.y + sp.h);
      ctx.lineTo(sx + spikeW / 2, sp.y);
      ctx.lineTo(sx + spikeW / 2, sp.y + sp.h);
      ctx.closePath();
      ctx.fill();

      // Crimson tip warning accent
      ctx.fillStyle = '#c93a48';
      ctx.fillRect(sx + spikeW / 2 - 1, sp.y, 2, 2);
    }
  }

  _drawTorch(ctx, x, y) {
    const flick = Math.sin(this.time * 16 + x) * 1.2;
    // Radial warm glow
    const r = 34 + flick * 2;
    const glow = ctx.createRadialGradient(x, y - 5, 2, x, y - 5, r);
    glow.addColorStop(0, 'rgba(255, 178, 76, 0.28)');
    glow.addColorStop(0.5, 'rgba(235, 114, 48, 0.1)');
    glow.addColorStop(1, 'rgba(235, 114, 48, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - r, y - 5 - r, r * 2, r * 2);

    // Bracket & sconce
    ctx.fillStyle = '#3b4152';
    ctx.fillRect(x - 1, y, 2, 10);
    ctx.fillStyle = '#5c6478';
    ctx.fillRect(x - 3, y - 1, 6, 3);

    // Flame
    ctx.fillStyle = '#eb6b2d';
    ctx.fillRect(Math.round(x - 2), Math.round(y - 6 - flick * 0.5), 4, 5);
    ctx.fillStyle = '#ffd56b';
    ctx.fillRect(Math.round(x - 1), Math.round(y - 5 - flick * 0.4), 2, 3);
  }

  _drawCheckpoint(ctx, cp) {
    const x = cp.x;
    const y = cp.y;
    // Stone hearth + crossed sword
    ctx.fillStyle = '#484f63';
    ctx.fillRect(x - 9, y - 3, 18, 3);
    ctx.fillStyle = '#636c85';
    ctx.fillRect(x - 7, y - 5, 14, 2);

    // Sword planted in bonfire
    ctx.fillStyle = '#adb8cf';
    ctx.fillRect(x - 1, y - 22, 2, 18);
    ctx.fillStyle = '#cfa04c';
    ctx.fillRect(x - 4, y - 18, 8, 2);
    ctx.fillRect(x - 1, y - 24, 2, 3);

    if (cp.lit) {
      const f = Math.sin(this.time * 14 + x) * 1.5;
      const g = ctx.createRadialGradient(x, y - 10, 2, x, y - 10, 42 + f * 2);
      g.addColorStop(0, 'rgba(255, 194, 92, 0.34)');
      g.addColorStop(0.55, 'rgba(240, 110, 45, 0.12)');
      g.addColorStop(1, 'rgba(240, 110, 45, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 46, y - 56, 92, 92);

      ctx.fillStyle = '#e85d2a';
      ctx.fillRect(x - 4, Math.round(y - 12 - f * 0.5), 8, 8);
      ctx.fillStyle = '#ffbe4a';
      ctx.fillRect(x - 3, Math.round(y - 10 - f * 0.4), 6, 6);
      ctx.fillStyle = '#fff5bd';
      ctx.fillRect(x - 1, Math.round(y - 8), 2, 4);
    }
  }

  _drawDummy(ctx, d) {
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(d.tilt * 0.12);

    const h = d.low ? 22 : 34;
    const flash = d.flash > 0;

    // Base stand
    ctx.fillStyle = '#523822';
    ctx.fillRect(-7, -3, 14, 3);
    ctx.fillStyle = '#6b492c';
    ctx.fillRect(-2, -h + 4, 4, h - 6);

    // Crossbar arms
    ctx.fillStyle = flash ? '#fff6d6' : '#7d5634';
    ctx.fillRect(-10, -h + 11, 20, 3);

    // Straw torso
    ctx.fillStyle = flash ? '#ffffff' : '#c9a050';
    ctx.fillRect(-6, -h + 8, 12, d.low ? 10 : 16);
    ctx.fillStyle = flash ? '#fff6d6' : '#a37c34';
    ctx.fillRect(-6, -h + 13, 12, 2);
    ctx.fillRect(-6, -h + 19, 12, 2);

    // Target bullseye on chest
    ctx.fillStyle = flash ? '#ffde8a' : '#b8323e';
    ctx.fillRect(-2, -h + 11, 4, 4);

    // Straw head
    ctx.fillStyle = flash ? '#ffffff' : '#d9b466';
    ctx.fillRect(-4, -h, 8, 8);
    ctx.fillStyle = '#4a351e';
    ctx.fillRect(-2, -h + 3, 1, 1);
    ctx.fillRect(1, -h + 3, 1, 1);

    ctx.restore();
  }

  _drawCrate(ctx, c) {
    ctx.fillStyle = '#7c4f2b';
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.fillStyle = '#a36b3c';
    ctx.fillRect(c.x + 1, c.y + 1, c.w - 2, 2);
    ctx.fillRect(c.x + 1, c.y + 1, 2, c.h - 2);
    // Diagonal brace
    ctx.strokeStyle = '#54331a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(c.x + 2, c.y + 2);
    ctx.lineTo(c.x + c.w - 2, c.y + c.h - 2);
    ctx.stroke();
    ctx.strokeStyle = '#362010';
    ctx.lineWidth = 1;
    ctx.strokeRect(c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1);
  }

  _drawBell(ctx) {
    const b = this.bell;
    // Wooden gallows frame on watchtower
    ctx.fillStyle = '#593b23';
    ctx.fillRect(b.x - 16, b.y - 12, 3, 50);
    ctx.fillRect(b.x + 13, b.y - 12, 3, 50);
    ctx.fillRect(b.x - 18, b.y - 14, 36, 4);

    if (b.glow > 0) {
      const r = 24 + (1 - b.glow) * 26;
      ctx.strokeStyle = `rgba(255, 224, 120, ${b.glow * 0.85})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(b.x, b.y + 6, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(b.x, b.y - 10);
    ctx.rotate(b.swing * 0.14);
    ctx.fillStyle = b.glow > 0.2 ? '#fff0a8' : '#e0b34c';
    ctx.fillRect(-5, 4, 10, 10);
    ctx.fillRect(-7, 13, 14, 4);
    ctx.fillStyle = '#996d22';
    ctx.fillRect(-1, 17, 2, 3);
    ctx.fillStyle = '#fff6cc';
    ctx.fillRect(-3, 6, 2, 7);
    ctx.restore();
  }
}

export function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}
