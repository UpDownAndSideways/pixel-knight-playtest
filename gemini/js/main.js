// Main game loop, input manager, camera controller, and HUD integration

import { SpriteBank } from './sprites.js';
import { SoundFX } from './audio.js';
import { ParticleSystem } from './particles.js';
import { Level, WORLD_W, WORLD_H } from './level.js';
import { Player } from './player.js';

const VIEW_W = 480;
const VIEW_H = 270;
const FIXED_DT = 1 / 60;

// DOM refs
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');
const loadingFill = document.getElementById('loading-fill');

const hpHeartsEl = document.getElementById('hp-hearts');
const dashBarEl = document.getElementById('dash-bar');
const airDashPipEl = document.getElementById('air-dash-pip');
const stateBadgeEl = document.getElementById('state-badge');
const animBadgeEl = document.getElementById('anim-badge');
const comboCardEl = document.getElementById('combo-card');
const comboNumEl = document.getElementById('combo-num');

const zoneBannerEl = document.getElementById('zone-banner');
const zoneTitleEl = document.getElementById('zone-title');
const zoneSubEl = document.getElementById('zone-sub');

const btnControls = document.getElementById('btn-controls');
const btnDebug = document.getElementById('btn-debug');
const btnSlowmo = document.getElementById('btn-slowmo');
const btnSound = document.getElementById('btn-sound');
const btnRespawn = document.getElementById('btn-respawn');
const controlsModal = document.getElementById('controls-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnResume = document.getElementById('btn-resume');

// Core systems
const sprites = new SpriteBank('./120x80_PNGSheets/');
const audio = new SoundFX();
const particles = new ParticleSystem();
const level = new Level();
const player = new Player(104, 272);

// App state
let debugMode = false;
let slowMo = false;
let paused = false;
let hitstopTimer = 0;

// Camera state
const cam = {
  x: 0,
  y: 50,
  lookAhead: 32,
  shake: 0,
};

// Zone banner tracker
let currentZoneTitle = '';
let zoneBannerTimer = 0;

// ---- INPUT SYSTEM ----
const keysDown = new Set();
const keysJustPressed = new Set();
let mouseAttackQueued = false;
let prevGamepadButtons = [];

const BLOCKED_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'F1',
]);

window.addEventListener('keydown', (e) => {
  audio.unlock();
  if (BLOCKED_KEYS.has(e.code)) e.preventDefault();

  if (!keysDown.has(e.code)) {
    keysJustPressed.add(e.code);

    // Global UI toggles
    if (e.code === 'Tab') {
      toggleControlsModal();
      return;
    }
    if (e.code === 'Escape' && !controlsModal.classList.contains('hidden')) {
      toggleControlsModal(false);
      return;
    }
    if (e.code === 'KeyB' || e.code === 'F1') {
      toggleDebug();
    } else if (e.code === 'KeyT') {
      toggleSlowMo();
    } else if (e.code === 'KeyM') {
      toggleSound();
    } else if (e.code === 'KeyR') {
      doRespawn();
    }
  }
  keysDown.add(e.code);
});

window.addEventListener('keyup', (e) => {
  keysDown.delete(e.code);
});

window.addEventListener('blur', () => {
  keysDown.clear();
  keysJustPressed.clear();
});

canvas.addEventListener('mousedown', (e) => {
  audio.unlock();
  if (e.button === 0 && !paused) {
    mouseAttackQueued = true;
  }
});

// UI Button handlers
btnControls.addEventListener('click', () => { audio.unlock(); toggleControlsModal(); });
btnCloseModal.addEventListener('click', () => toggleControlsModal(false));
btnResume.addEventListener('click', () => toggleControlsModal(false));
btnDebug.addEventListener('click', () => { audio.unlock(); toggleDebug(); });
btnSlowmo.addEventListener('click', () => { audio.unlock(); toggleSlowMo(); });
btnSound.addEventListener('click', () => { audio.unlock(); toggleSound(); });
btnRespawn.addEventListener('click', () => { audio.unlock(); doRespawn(); });

function toggleControlsModal(forceState) {
  const show = forceState !== undefined ? forceState : controlsModal.classList.contains('hidden');
  controlsModal.classList.toggle('hidden', !show);
  btnControls.classList.toggle('active', show);
  paused = show;
}

function toggleDebug() {
  debugMode = !debugMode;
  btnDebug.classList.toggle('active', debugMode);
}

function toggleSlowMo() {
  slowMo = !slowMo;
  btnSlowmo.classList.toggle('active', slowMo);
}

function toggleSound() {
  audio.enabled = !audio.enabled;
  btnSound.innerHTML = `<span class="key-hint">M</span> SFX: ${audio.enabled ? 'ON' : 'OFF'}`;
  btnSound.classList.toggle('active', !audio.enabled);
}

function doRespawn() {
  player.respawn(true);
  particles.spawnSparks(player.x, player.y - 16, 12, '#ffe599', '#f08b3e', 0);
  particles.addText(player.x, player.top - 6, 'RESPAWN', '#ffe599', 0.8);
  audio.checkpoint();
}

function pollInput() {
  let left = keysDown.has('KeyA') || keysDown.has('ArrowLeft');
  let right = keysDown.has('KeyD') || keysDown.has('ArrowRight');
  let down = keysDown.has('KeyS') || keysDown.has('ArrowDown');
  let upPressed = keysJustPressed.has('KeyW') || keysJustPressed.has('ArrowUp');

  let jumpHeld = keysDown.has('Space') || keysDown.has('KeyW') || keysDown.has('ArrowUp');
  let jumpPressed = keysJustPressed.has('Space') || keysJustPressed.has('KeyW') || keysJustPressed.has('ArrowUp');

  let attackPressed = keysJustPressed.has('KeyJ') || keysJustPressed.has('KeyZ') || mouseAttackQueued;
  let rollPressed = keysJustPressed.has('KeyK') || keysJustPressed.has('KeyX');
  let slidePressed = keysJustPressed.has('KeyC');
  let dashPressed =
    keysJustPressed.has('KeyL') ||
    keysJustPressed.has('ShiftLeft') ||
    keysJustPressed.has('ShiftRight') ||
    keysJustPressed.has('KeyE');

  const testHitPressed = keysJustPressed.has('KeyH');
  const testDeathPressed = keysJustPressed.has('KeyV');

  // Optional Gamepad API support
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = pads && pads[0];
  if (gp) {
    const ax = gp.axes[0] || 0;
    const ay = gp.axes[1] || 0;
    if (ax < -0.35 || gp.buttons[14]?.pressed) left = true;
    if (ax > 0.35 || gp.buttons[15]?.pressed) right = true;
    if (ay > 0.45 || gp.buttons[13]?.pressed) down = true;

    const btn = (i) => !!gp.buttons[i]?.pressed;
    const just = (i) => btn(i) && !prevGamepadButtons[i];

    if (btn(0)) jumpHeld = true;
    if (just(0)) jumpPressed = true;
    if (just(12)) upPressed = true;
    if (just(2)) attackPressed = true; // X / Square
    if (just(1)) rollPressed = true;   // B / Circle
    if (just(5) || just(7) || just(3)) dashPressed = true; // RB / RT / Y

    prevGamepadButtons = gp.buttons.map((b) => b.pressed);
  }

  mouseAttackQueued = false;
  keysJustPressed.clear();

  const moveX = (right ? 1 : 0) - (left ? 1 : 0);

  return {
    moveX,
    down,
    upPressed,
    jumpHeld,
    jumpPressed,
    attackPressed,
    rollPressed,
    slidePressed,
    dashPressed,
    testHitPressed,
    testDeathPressed,
  };
}

// ---- HUD RENDERING ----
let lastRenderedHp = -1;
const HEART_SVG = `<svg viewBox="0 0 16 15" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M4.5 1C2.3 1 0.8 2.8 0.8 5C0.8 8.4 4.8 11.4 8 14C11.2 11.4 15.2 8.4 15.2 5C15.2 2.8 13.7 1 11.5 1C9.9 1 8.7 1.9 8 3C7.3 1.9 6.1 1 4.5 1Z" fill="#e05463" stroke="#2c0d14" stroke-width="1.4"/>
  <rect x="3.5" y="3.2" width="2.2" height="1.8" rx="0.6" fill="#ffadb7"/>
</svg>`;

function syncHUD() {
  if (lastRenderedHp !== player.hp) {
    lastRenderedHp = player.hp;
    let html = '';
    for (let i = 0; i < player.maxHp; i++) {
      html += `<span class="heart ${i >= player.hp ? 'empty' : ''}">${HEART_SVG}</span>`;
    }
    hpHeartsEl.innerHTML = html;
  }

  const dashPct = Math.round((1 - Math.min(1, player.dashCooldown / 0.65)) * 100);
  dashBarEl.style.width = `${dashPct}%`;
  airDashPipEl.classList.toggle('spent', !player.airDashReady);

  stateBadgeEl.textContent = player.state;
  animBadgeEl.textContent = player.animator.label;

  if (player.comboCount > 0) {
    comboCardEl.classList.remove('hidden');
    comboNumEl.textContent = player.comboCount;
  } else {
    comboCardEl.classList.add('hidden');
  }
}

function updateZoneBanner(dt) {
  const zone = level.getZoneAt(player.x);
  if (zone.title !== currentZoneTitle) {
    currentZoneTitle = zone.title;
    zoneTitleEl.textContent = zone.title;
    zoneSubEl.textContent = zone.sub;
    zoneBannerEl.classList.remove('hidden');
    zoneBannerTimer = 3.2;
  }
  if (zoneBannerTimer > 0) {
    zoneBannerTimer -= dt;
    if (zoneBannerTimer <= 0) {
      zoneBannerEl.classList.add('hidden');
    }
  }
}

// ---- CAMERA ----
function updateCamera(dt) {
  const desiredLook = player.facing * 36;
  cam.lookAhead += (desiredLook - cam.lookAhead) * Math.min(1, dt * 4.5);

  const targetX = player.x + cam.lookAhead - VIEW_W * 0.5;
  const targetY = player.y - 34 - VIEW_H * 0.54;

  const clampedX = Math.max(0, Math.min(WORLD_W - VIEW_W, targetX));
  const clampedY = Math.max(0, Math.min(WORLD_H - VIEW_H, targetY));

  cam.x += (clampedX - cam.x) * Math.min(1, dt * 8.5);
  cam.y += (clampedY - cam.y) * Math.min(1, dt * 6.5);

  if (cam.shake > 0) {
    cam.shake = Math.max(0, cam.shake - dt * 22);
  }
}

// ---- MAIN LOOP ----
let lastTime = 0;
let accumulator = 0;

function stepSimulation(dt) {
  if (hitstopTimer > 0) {
    hitstopTimer -= dt;
    particles.update(dt * 0.25, WORLD_W, WORLD_H);
    return;
  }

  const input = pollInput();
  player.update(dt, input, level, particles, audio);

  if (player.pendingShake > 0) {
    cam.shake = Math.max(cam.shake, player.pendingShake);
    player.pendingShake = 0;
  }
  if (player.pendingHitstop > 0) {
    hitstopTimer = Math.max(hitstopTimer, player.pendingHitstop);
    player.pendingHitstop = 0;
  }

  level.update(dt, particles);
  particles.update(dt, WORLD_W, WORLD_H);
  updateCamera(dt);
  updateZoneBanner(dt);
  syncHUD();
}

function render() {
  ctx.imageSmoothingEnabled = false;

  const shakeX = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake * 2 : 0;
  const shakeY = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake * 2 : 0;
  const rx = Math.round(cam.x + shakeX);
  const ry = Math.round(cam.y + shakeY);

  // 1. Parallax twilight sky & distant citadel
  level.drawBackground(ctx, rx, ry, VIEW_W, VIEW_H);

  // 2. World-space geometry & entities
  ctx.save();
  ctx.translate(-rx, -ry);

  level.drawWorldBehindPlayer(ctx, rx, ry, VIEW_W, VIEW_H);
  particles.drawAmbient(ctx, rx, ry, VIEW_W, VIEW_H);
  particles.drawAfterimages(ctx, sprites);
  player.draw(ctx, sprites, debugMode);
  particles.drawParticles(ctx);
  particles.drawTexts(ctx);

  ctx.restore();

  // 3. Subtle atmospheric vignette
  const vig = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.42, VIEW_W / 2, VIEW_H / 2, VIEW_W * 0.66);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(4,6,12,0.34)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // 4. Slow-mo tint indicator
  if (slowMo) {
    ctx.strokeStyle = 'rgba(230, 184, 92, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, VIEW_W - 2, VIEW_H - 2);
  }
}

function frame(ts) {
  if (!lastTime) lastTime = ts;
  const rawDt = Math.min(0.05, (ts - lastTime) / 1000);
  lastTime = ts;

  if (!paused) {
    const scale = slowMo ? 0.3 : 1.0;
    accumulator += rawDt * scale;
    while (accumulator >= FIXED_DT) {
      stepSimulation(FIXED_DT);
      accumulator -= FIXED_DT;
    }
  } else {
    // Discard buffered presses while paused
    keysJustPressed.clear();
    mouseAttackQueued = false;
  }

  render();
  requestAnimationFrame(frame);
}

// ---- BOOTSTRAP ----
async function init() {
  particles.initAmbientEmbers(WORLD_W, WORLD_H, 55);

  try {
    await sprites.loadAll((loaded, total, file) => {
      loadingFill.style.width = `${Math.round((loaded / total) * 100)}%`;
      loadingText.textContent = `Loading ${file} (${loaded}/${total})`;
    });
  } catch (err) {
    loadingText.textContent = `Error: ${err.message}`;
    return;
  }

  // Snap camera to spawn
  cam.x = Math.max(0, player.x - VIEW_W * 0.42);
  cam.y = Math.max(0, Math.min(WORLD_H - VIEW_H, player.y - 34 - VIEW_H * 0.54));
  syncHUD();
  loadingOverlay.classList.add('hidden');
  requestAnimationFrame(frame);
}

init();
