import { settings } from './ui/settings';

export type SfxName = 'click' | 'deploy' | 'hit' | 'wall' | 'cannon' | 'holy' | 'capture' | 'victory' | 'defeat';

/**
 * 程序化音效：不加载任何外部音频文件，全部用 Web Audio 合成。
 * 浏览器要求用户手势后才能启动 AudioContext，这里在首次播放时惰性创建。
 */
class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private lastPlay = new Map<SfxName, number>();

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      return this.ctx;
    } catch {
      return null;
    }
  }

  resume(): void {
    const ctx = this.ensure();
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  }

  play(name: SfxName): void {
    if (settings.muted) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    if (ctx.state === 'suspended') void ctx.resume();
    const now = ctx.currentTime;
    const gate = { click: 0.04, deploy: 0.06, hit: 0.035, wall: 0.16, cannon: 0.12, holy: 0.1, capture: 0.2, victory: 0.5, defeat: 0.5 }[name];
    const last = this.lastPlay.get(name) ?? -1;
    if (now - last < gate) return;
    this.lastPlay.set(name, now);

    switch (name) {
      case 'click':
        this.blip(520, 0.05, 'square', 0.12);
        break;
      case 'deploy':
        this.noise(0.18, 240, 0.18);
        this.blip(120, 0.12, 'sine', 0.18);
        break;
      case 'hit':
        this.noise(0.06, 900, 0.1);
        break;
      case 'wall':
        this.noise(0.5, 180, 0.35);
        this.blip(70, 0.4, 'sine', 0.28);
        break;
      case 'cannon':
        this.blip(140, 0.32, 'sawtooth', 0.22, 40);
        this.noise(0.3, 300, 0.3);
        break;
      case 'holy':
        this.blip(880, 0.18, 'triangle', 0.1, 1320);
        break;
      case 'capture':
        this.blip(392, 0.18, 'triangle', 0.14);
        window.setTimeout(() => this.blip(587, 0.24, 'triangle', 0.14), 120);
        break;
      case 'victory':
        [392, 494, 587, 784].forEach((f, i) => window.setTimeout(() => this.blip(f, 0.5, 'triangle', 0.16), i * 180));
        break;
      case 'defeat':
        [392, 330, 262, 196].forEach((f, i) => window.setTimeout(() => this.blip(f, 0.6, 'sine', 0.16), i * 220));
        break;
    }
  }

  private blip(from: number, dur: number, type: OscillatorType, gain: number, to?: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, ctx.currentTime);
    if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), ctx.currentTime + dur);
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  private noise(dur: number, cutoff: number, gain: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.2);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(Math.max(80, cutoff * 0.3), ctx.currentTime + dur);
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start();
  }
}

export const sfx = new Sfx();
