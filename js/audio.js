// Selvstendig WebAudio-lydmotor (alt syntetiseres — ingen lydfiler).
// Singleton som speiler stilen til Input/ASSETS. Tåler å bli kalt før init / når dempet.
const Sound = {
  ctx: null,
  ready: false,
  muted: false,
  engineOn: false,
  _thudT: -1,

  ensure() {
    if (this.ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      const ctx = new AC();
      this.ctx = ctx;

      this.master = ctx.createGain();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -12; comp.ratio.value = 12; comp.release.value = 0.25;
      this.master.connect(comp); comp.connect(ctx.destination);

      const sub = (v) => { const g = ctx.createGain(); g.gain.value = v; g.connect(this.master); return g; };
      this.engineGain = sub(0.30);
      this.engineBase = 0.30;
      this.screechGain = sub(0.0);
      this.sfxGain = sub(0.6);
      this.musicGain = sub(0.5);

      // Hvit støy (gjenbrukes til skrik/whoosh/thud)
      const len = ctx.sampleRate;
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

      try { this.muted = localStorage.getItem("fgp_muted") === "1"; } catch (e) {}
      this.master.gain.value = this.muted ? 0 : 1;
      this.ready = true;
      return true;
    } catch (e) { return false; }
  },

  unlock() { if (this.ctx && this.ctx.state === "suspended") this.ctx.resume(); },

  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem("fgp_muted", m ? "1" : "0"); } catch (e) {}
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.02);
  },
  toggleMute() { if (!this.ensure()) { this.muted = !this.muted; return; } this.setMuted(!this.muted); },

  // --- Engangslyder ---
  _osc(type, freq, dur, peak, dest, opt) {
    if (!this.ready) return;
    opt = opt || {};
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (opt.freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(1, opt.freqEnd), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + (opt.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfxGain);
    o.start(t); o.stop(t + dur + 0.05);
    o.onended = () => { o.disconnect(); g.disconnect(); };
  },

  _noise(dur, peak, type, freq, dest) {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type || "bandpass"; f.frequency.value = freq || 1200; f.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(dest || this.sfxGain);
    src.start(t); src.stop(t + dur + 0.02);
    src.onended = () => { src.disconnect(); f.disconnect(); g.disconnect(); };
  },

  pickup() { this._osc("square", 740, 0.07, 0.4); this._osc("square", 1180, 0.09, 0.35, null, { attack: 0.06 }); },
  boostWhoosh() { this._noise(0.4, 0.5, "bandpass", 600); this._osc("sawtooth", 220, 0.4, 0.25, null, { freqEnd: 900 }); },
  drop() { this._osc("sine", 200, 0.18, 0.4, null, { freqEnd: 90 }); this._noise(0.12, 0.25, "lowpass", 500); },
  thud(strength) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    if (t - this._thudT < 0.12) return;
    this._thudT = t;
    const s = Math.max(0.2, Math.min(1, strength));
    this._osc("sine", 110, 0.18, 0.5 * s, null, { freqEnd: 55 });
    this._noise(0.1, 0.3 * s, "lowpass", 400);
  },
  beep() { this._osc("square", 680, 0.14, 0.45, this.musicGain); },
  go() { this._osc("square", 1040, 0.35, 0.5, this.musicGain, { attack: 0.01 }); },
  fanfare(win) {
    if (!this.ensure()) return;
    const notes = win ? [523, 659, 784, 1047, 1319] : [392, 440, 523, 587];
    notes.forEach((f, i) => {
      const ctx = this.ctx, t0 = ctx.currentTime + i * 0.12;
      const o = ctx.createOscillator(); o.type = "square"; o.frequency.value = f;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.4, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
      o.connect(g); g.connect(this.musicGain); o.start(t0); o.stop(t0 + 0.35);
      o.onended = () => { o.disconnect(); g.disconnect(); };
    });
  },

  // --- Motor-drone + dekkskrik (kontinuerlig under løp) ---
  startEngine() {
    if (!this.ensure() || this.engineOn) return;
    const ctx = this.ctx;
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 600;
    const o1 = ctx.createOscillator(); o1.type = "sawtooth"; o1.frequency.value = 70;
    const o2 = ctx.createOscillator(); o2.type = "sawtooth"; o2.frequency.value = 70.7;
    o1.connect(lp); o2.connect(lp); lp.connect(this.engineGain);
    o1.start(); o2.start();
    this.engine = { o1, o2, lp };

    const sc = ctx.createBufferSource(); sc.buffer = this.noiseBuf; sc.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1800; bp.Q.value = 6;
    const sg = ctx.createGain(); sg.gain.value = 0;
    sc.connect(bp); bp.connect(sg); sg.connect(this.screechGain); sc.start();
    this.screech = { sc, bp, sg };

    this.engineGain.gain.value = this.engineBase;
    this.engineOn = true;
  },
  updateEngine(speed, top, boosting) {
    if (!this.engineOn) return;
    const t = this.ctx.currentTime;
    const ratio = Math.min(1.6, speed / top);
    const f = 60 + ratio * 200 * (boosting ? 1.25 : 1);
    this.engine.o1.frequency.setTargetAtTime(f, t, 0.05);
    this.engine.o2.frequency.setTargetAtTime(f * 1.01, t, 0.05);
    this.engine.lp.frequency.setTargetAtTime(500 + ratio * 1800, t, 0.06);
  },
  updateScreech(intensity) {
    if (!this.engineOn) return;
    this.screech.sg.gain.setTargetAtTime(Math.max(0, Math.min(1, intensity)) * 0.6, this.ctx.currentTime, 0.05);
  },
  duckEngine(on) {
    if (!this.engineOn) return;
    this.engineGain.gain.setTargetAtTime(on ? 0 : this.engineBase, this.ctx.currentTime, 0.05);
  },
  stopEngine() {
    if (!this.engineOn) return;
    try { this.engine.o1.stop(); this.engine.o2.stop(); this.screech.sc.stop(); } catch (e) {}
    try { this.engine.o1.disconnect(); this.engine.o2.disconnect(); this.engine.lp.disconnect(); this.screech.sc.disconnect(); this.screech.bp && this.screech.bp.disconnect(); this.screech.sg.disconnect(); } catch (e) {}
    this.engineOn = false;
  },
};
