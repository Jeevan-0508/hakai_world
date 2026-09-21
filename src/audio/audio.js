// Synthesized environmental audio — section 21. No audio files shipped, mirrors the
// existing HAKAI PROTOCOL audio_engine.js approach (Web Audio API only).
export class WorldAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.master = null;
    this.nextCall = 4 + Math.random() * 4;
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this._startDrone();
    this._startWind();
  }

  _startDrone() {
    const ctx = this.ctx;
    const osc1 = ctx.createOscillator(); osc1.type = 'sine'; osc1.frequency.value = 55;
    const osc2 = ctx.createOscillator(); osc2.type = 'sine'; osc2.frequency.value = 82.5;
    const gain = ctx.createGain(); gain.gain.value = 0.05;
    osc1.connect(gain); osc2.connect(gain); gain.connect(this.master);
    osc1.start(); osc2.start();
    this.drone = { osc1, osc2, gain };
  }

  _noiseBuffer() {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  _startWind() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer();
    src.loop = true;
    const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.frequency.value = 400; filter.Q.value = 0.6;
    const gain = ctx.createGain(); gain.gain.value = 0.03;
    src.connect(filter); filter.connect(gain); gain.connect(this.master);
    src.start();
    this.wind = { src, filter, gain };
  }

  setWeather(state) {
    if (!this.wind) return;
    const targets = { clear: 0.02, fog: 0.035, emberstorm: 0.09, voidcalm: 0.015 };
    this.wind.gain.gain.setTargetAtTime(targets[state] ?? 0.02, this.ctx.currentTime, 0.8);
  }

  setNight(isNight) {
    if (!this.drone) return;
    this.drone.gain.gain.setTargetAtTime(isNight ? 0.08 : 0.05, this.ctx.currentTime, 1.5);
    this.drone.osc1.frequency.setTargetAtTime(isNight ? 48 : 55, this.ctx.currentTime, 2);
  }

  setEvent(active) {
    if (!this.drone) return;
    this.drone.gain.gain.setTargetAtTime(active ? 0.14 : 0.05, this.ctx.currentTime, 0.6);
  }

  footstep() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = 90 + Math.random() * 20;
    const gain = ctx.createGain(); gain.gain.value = 0.0001;
    osc.connect(gain); gain.connect(this.master);
    const t = ctx.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.05, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    osc.start(t); osc.stop(t + 0.1);
  }

  creatureCall(pan = 0, pitch = 220) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = pitch;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 900;
    const gain = ctx.createGain(); gain.gain.value = 0.0001;
    const panner = ctx.createStereoPanner(); panner.pan.value = Math.max(-1, Math.min(1, pan));
    osc.connect(filter); filter.connect(gain); gain.connect(panner); panner.connect(this.master);
    const t = ctx.currentTime;
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.6, t + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.06, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    osc.start(t); osc.stop(t + 0.9);
  }

  eventStinger() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 60;
    const gain = ctx.createGain(); gain.gain.value = 0.0001;
    osc.connect(gain); gain.connect(this.master);
    const t = ctx.currentTime;
    gain.gain.exponentialRampToValueAtTime(0.2, t + 0.1);
    osc.frequency.exponentialRampToValueAtTime(30, t + 3);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
    osc.start(t); osc.stop(t + 3.3);
  }

  update(dt, world) {
    if (!this.ctx) return;
    this.nextCall -= dt;
    if (this.nextCall <= 0 && world.creatures.length) {
      this.nextCall = 3 + Math.random() * 6;
      const c = world.creatures[Math.floor(Math.random() * world.creatures.length)];
      const dx = c.pos.x - world.player.pos.x;
      const dz = c.pos.z - world.player.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 60) this.creatureCall(dx / 40, c.def.nocturnal ? 140 : 260);
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime, 0.2);
    return this.muted;
  }
}
