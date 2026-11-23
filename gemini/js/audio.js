// Lightweight procedural retro SFX synthesizer using Web Audio API

export class SoundFX {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.noiseBuffer = null;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this._buildNoiseBuffer();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  _buildNoiseBuffer() {
    const sr = this.ctx.sampleRate;
    const len = sr * 0.5;
    const buf = this.ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buf;
  }

  _tone(type, f0, f1, dur, vol = 0.12, delay = 0) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    }
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.01);
  }

  _noise(dur, filterFreq, filterType = 'bandpass', vol = 0.12, q = 1.2, delay = 0) {
    if (!this.enabled || !this.ctx || !this.noiseBuffer) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, t);
    filter.Q.setValueAtTime(q, t);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(t);
    src.stop(t + dur + 0.01);
  }

  step() {
    this._noise(0.035, 340 + Math.random() * 120, 'bandpass', 0.045, 2.0);
  }

  jump() {
    this._tone('triangle', 170, 420, 0.12, 0.1);
    this._noise(0.05, 900, 'highpass', 0.035, 1.0);
  }

  wallJump() {
    this._tone('triangle', 220, 520, 0.11, 0.11);
    this._noise(0.06, 650, 'bandpass', 0.06, 1.5);
  }

  land(heavy = false) {
    this._tone('sine', heavy ? 110 : 140, 42, heavy ? 0.12 : 0.07, heavy ? 0.14 : 0.08);
    this._noise(heavy ? 0.09 : 0.05, 280, 'lowpass', heavy ? 0.1 : 0.05, 1.0);
  }

  skid() {
    this._noise(0.09, 1200, 'bandpass', 0.05, 2.5);
  }

  slash1() {
    this._noise(0.11, 1800, 'bandpass', 0.13, 1.1);
    this._tone('sawtooth', 420, 140, 0.09, 0.06);
  }

  slash2() {
    this._noise(0.16, 1300, 'bandpass', 0.16, 0.9);
    this._tone('sawtooth', 320, 95, 0.14, 0.09);
  }

  crouchSlash() {
    this._noise(0.09, 2200, 'bandpass', 0.11, 1.4);
    this._tone('triangle', 500, 180, 0.08, 0.06);
  }

  hitTarget(heavy = false) {
    this._tone('square', heavy ? 160 : 210, 58, heavy ? 0.11 : 0.08, 0.11);
    this._noise(0.07, 900, 'bandpass', 0.12, 1.2);
  }

  crateBreak() {
    this._noise(0.16, 650, 'bandpass', 0.16, 0.8);
    this._tone('sawtooth', 190, 50, 0.14, 0.1);
    this._noise(0.1, 1800, 'highpass', 0.08, 1.0, 0.03);
  }

  dash() {
    this._noise(0.14, 2400, 'bandpass', 0.12, 1.6);
    this._tone('sine', 520, 180, 0.12, 0.08);
  }

  roll() {
    this._noise(0.14, 520, 'bandpass', 0.08, 1.3);
    this._tone('triangle', 160, 110, 0.12, 0.06);
  }

  slide() {
    this._noise(0.18, 950, 'bandpass', 0.09, 2.0);
  }

  ledgeGrab() {
    this._tone('triangle', 200, 290, 0.05, 0.08);
    this._noise(0.04, 500, 'bandpass', 0.06, 1.8);
  }

  ledgeClimb() {
    this._noise(0.08, 420, 'bandpass', 0.06, 1.5);
    this._tone('triangle', 180, 260, 0.09, 0.06, 0.05);
  }

  hurt() {
    this._tone('sawtooth', 190, 72, 0.18, 0.14);
    this._noise(0.12, 480, 'lowpass', 0.13, 1.0);
  }

  death() {
    this._tone('sawtooth', 220, 55, 0.42, 0.15);
    this._tone('square', 140, 40, 0.45, 0.09, 0.08);
    this._noise(0.25, 360, 'lowpass', 0.12, 1.0, 0.05);
  }

  checkpoint() {
    this._tone('sine', 523.25, 523.25, 0.16, 0.09, 0);
    this._tone('sine', 659.25, 659.25, 0.18, 0.09, 0.07);
    this._tone('sine', 783.99, 783.99, 0.28, 0.1, 0.14);
  }

  bell() {
    this._tone('sine', 587.33, 585, 0.85, 0.14, 0);
    this._tone('triangle', 1174.66, 1170, 0.55, 0.07, 0);
    this._tone('sine', 880, 878, 0.65, 0.06, 0.02);
  }
}
