import type { DrumId } from '../data/pattern';
import type { DrumParams } from '../data/sounds';
import { noiseSource } from './noise';

/** 808 cymbal oscillator frequencies (Hz): six detuned squares make the metallic hat tone. */
export const METAL_FREQS = [205.3, 304.4, 369.6, 522.7, 540, 800] as const;

/** Tune 0..1 (0.5 neutral) → frequency multiplier, ±1 octave. */
export const tuneFactor = (tune: number): number => 2 ** ((tune - 0.5) * 2);

/** 909/808-flavoured synthesized drum kit. Open hat is choked by the closed hat. */
export class DrumKit {
  private openHat: GainNode | null = null;

  constructor(
    private readonly ctx: AudioContext,
    private readonly outs: Record<DrumId, AudioNode>,
  ) {}

  play(id: DrumId, t: number, accent: boolean, p: DrumParams): void {
    const vel = accent ? 1 : 0.72;
    const out = this.outs[id];
    const tune = tuneFactor(p.tune);
    switch (id) {
      case 'kick':
        return this.kick(out, t, vel, tune, p.decay);
      case 'snare':
        return this.snare(out, t, vel, tune, p.decay);
      case 'clap':
        return this.clap(out, t, vel, tune, p.decay);
      case 'chh':
        this.choke(t);
        this.metal(out, t, vel * 0.55, tune, 0.03 + p.decay * 0.08, 7000);
        return;
      case 'ohh':
        this.choke(t);
        this.openHat = this.metal(out, t, vel * 0.5, tune, 0.15 + p.decay * 0.6, 7000);
        return;
      case 'ride':
        this.metal(out, t, vel * 0.35, tune * 1.4, 0.4 + p.decay * 1.4, 5000);
        return;
    }
  }

  private env(t: number, peak: number, decay: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    return g;
  }

  private kick(out: AudioNode, t: number, vel: number, tune: number, decay: number): void {
    const c = this.ctx;
    const len = 0.2 + decay * 0.9;
    const osc = c.createOscillator();
    osc.frequency.setValueAtTime(170 * tune, t);
    osc.frequency.exponentialRampToValueAtTime(48 * tune, t + 0.07);
    osc.frequency.exponentialRampToValueAtTime(42 * tune, t + len);
    const g = this.env(t, vel * 1.1, len);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + len + 0.05);
    // Beater click.
    const click = noiseSource(c);
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2500;
    const cg = this.env(t, vel * 0.35, 0.012);
    click.connect(hp).connect(cg).connect(out);
    click.start(t);
    click.stop(t + 0.03);
  }

  private snare(out: AudioNode, t: number, vel: number, tune: number, decay: number): void {
    const c = this.ctx;
    for (const f of [180, 330]) {
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f * tune * 1.3, t);
      o.frequency.exponentialRampToValueAtTime(f * tune, t + 0.03);
      const g = this.env(t, vel * 0.45, 0.12);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.15);
    }
    const n = noiseSource(c);
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1200 * tune;
    const len = 0.1 + decay * 0.3;
    const g = this.env(t, vel * 0.7, len);
    n.connect(hp).connect(g).connect(out);
    n.start(t);
    n.stop(t + len + 0.02);
  }

  private clap(out: AudioNode, t: number, vel: number, tune: number, decay: number): void {
    const c = this.ctx;
    const n = noiseSource(c);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1100 * tune;
    bp.Q.value = 1.4;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    // Three quick slaps, then the room tail.
    for (let i = 0; i < 3; i++) {
      const s = t + i * 0.011;
      g.gain.setValueAtTime(vel, s);
      g.gain.exponentialRampToValueAtTime(0.08, s + 0.009);
    }
    const tail = 0.12 + decay * 0.35;
    g.gain.setValueAtTime(vel * 0.8, t + 0.033);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.033 + tail);
    n.connect(bp).connect(g).connect(out);
    n.start(t);
    n.stop(t + 0.05 + tail);
  }

  private metal(
    out: AudioNode,
    t: number,
    vel: number,
    tune: number,
    len: number,
    hpHz: number,
  ): GainNode {
    const c = this.ctx;
    const mix = c.createGain();
    mix.gain.value = 1 / 6;
    for (const f of METAL_FREQS) {
      const o = c.createOscillator();
      o.type = 'square';
      o.frequency.value = f * tune * 1.5;
      o.connect(mix);
      o.start(t);
      o.stop(t + len + 0.05);
    }
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 10000;
    bp.Q.value = 0.8;
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = hpHz;
    const g = this.env(t, vel, len);
    mix.connect(bp).connect(hp).connect(g).connect(out);
    return g;
  }

  private choke(t: number): void {
    const g = this.openHat;
    if (!g) return;
    g.gain.cancelScheduledValues(t);
    g.gain.setTargetAtTime(0, t, 0.008);
    this.openHat = null;
  }
}
