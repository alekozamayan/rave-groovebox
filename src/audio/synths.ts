import { CHORDS, midiToFreq } from '../data/notes';
import { FM_ALGOS } from '../data/fm';
import { FM_RATIOS, type SynthParams } from '../data/sounds';
import { cutoffHz, driveCurve } from './fxmath';

export interface NoteSpec {
  time: number;
  note: number;
  /** Seconds to hold; null = until release() (live play). */
  gate: number | null;
  accent: boolean;
  legato: boolean;
  /** Per-step cutoff lock, 0..1. */
  cutoff?: number;
}

export interface Held {
  release(t: number): void;
}

/** Amp/filter decay time constant from the 0..1 decay param. */
export const decayTc = (decay: number): number => 0.03 + decay * decay * 0.9;

/**
 * Monophonic 303-style acid voice: saw/square → 2× resonant low-pass (24 dB) →
 * VCA → drive. Slides glide pitch without re-triggering the envelopes.
 */
export class AcidVoice {
  private saw: OscillatorNode;
  private sq: OscillatorNode;
  private sawG: GainNode;
  private sqG: GainNode;
  private f1: BiquadFilterNode;
  private f2: BiquadFilterNode;
  private vca: GainNode;
  private freq = 110;

  constructor(ctx: AudioContext, out: AudioNode) {
    this.saw = ctx.createOscillator();
    this.saw.type = 'sawtooth';
    this.sq = ctx.createOscillator();
    this.sq.type = 'square';
    this.sawG = ctx.createGain();
    this.sqG = ctx.createGain();
    this.f1 = ctx.createBiquadFilter();
    this.f2 = ctx.createBiquadFilter();
    this.f1.type = this.f2.type = 'lowpass';
    this.f2.Q.value = 0.5;
    this.vca = ctx.createGain();
    this.vca.gain.value = 0;
    const drive = ctx.createWaveShaper();
    drive.curve = driveCurve(0.4) as Float32Array<ArrayBuffer>;
    this.saw.connect(this.sawG).connect(this.f1);
    this.sq.connect(this.sqG).connect(this.f1);
    this.f1.connect(this.f2).connect(this.vca).connect(drive).connect(out);
    this.saw.start();
    this.sq.start();
  }

  play(n: NoteSpec, p: SynthParams): void {
    const t = n.time;
    const f = midiToFreq(n.note);
    for (const o of [this.saw, this.sq]) {
      o.frequency.cancelScheduledValues(t);
      if (n.legato) {
        o.frequency.setValueAtTime(this.freq, t);
        o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
      } else o.frequency.setValueAtTime(f, t);
    }
    this.freq = f;
    this.sawG.gain.setValueAtTime(1 - p.tone, t);
    this.sqG.gain.setValueAtTime(p.tone * 0.8, t);
    this.f1.Q.setValueAtTime(0.7 + p.reso * (n.accent ? 24 : 18), t);

    const base = cutoffHz(n.cutoff ?? p.cutoff);
    const vca = this.vca.gain;
    vca.cancelScheduledValues(t);
    if (!n.legato) {
      const peak = Math.min(16000, base * 2 ** (p.envMod * (n.accent ? 5.5 : 4)));
      const tc = n.accent ? decayTc(p.decay) * 0.5 : decayTc(p.decay);
      for (const flt of [this.f1.frequency, this.f2.frequency]) {
        flt.cancelScheduledValues(t);
        flt.setValueAtTime(peak, t);
        flt.setTargetAtTime(base, t + 0.003, tc);
      }
      vca.setTargetAtTime(n.accent ? 0.95 : 0.65, t, 0.002);
    }
    if (n.gate !== null) vca.setTargetAtTime(0, t + n.gate, 0.008);
  }

  release(t: number): void {
    this.vca.gain.cancelScheduledValues(t);
    this.vca.gain.setTargetAtTime(0, t, 0.01);
  }
}

/** One polyphonic note (possibly a chord) on the FM or supersaw engine. */
export function playPoly(ctx: AudioContext, out: AudioNode, n: NoteSpec, p: SynthParams): Held {
  const t = n.time;
  const shape = CHORDS[p.chord]?.notes ?? [0];
  const notes = shape.map((s) => n.note + s);
  const vel = n.accent ? 1 : 0.75;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 0.7 + p.reso * 10;
  const base = cutoffHz(n.cutoff ?? p.cutoff);
  const tc = decayTc(p.decay);
  const peak = Math.min(18000, base * 2 ** (p.envMod * (n.accent ? 5 : 4)));
  filter.frequency.setValueAtTime(peak, t);
  filter.frequency.setTargetAtTime(base, t + 0.004, tc);

  const amp = ctx.createGain();
  const level = vel / Math.sqrt(notes.length);
  const sustain = 0.1 + 0.9 * p.decay * p.decay;
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(level, t + 0.005);
  amp.gain.setTargetAtTime(level * sustain, t + 0.005, tc);
  filter.connect(amp).connect(out);

  const oscs: OscillatorNode[] = [];
  if (p.engine === 'fm') buildFm(ctx, filter, notes, t, n.accent, p, oscs);
  else buildSaw(ctx, filter, notes, p, oscs);
  for (const o of oscs) o.start(t);

  let released = false;
  const release = (rt: number) => {
    if (released) return;
    released = true;
    const r = Math.max(rt, t + 0.006);
    amp.gain.cancelScheduledValues(r);
    amp.gain.setTargetAtTime(0, r, 0.03 + p.decay * 0.12);
    for (const o of oscs) o.stop(r + 0.8);
  };
  if (n.gate !== null) release(t + n.gate);
  return { release };
}

function buildSaw(
  ctx: AudioContext,
  dest: AudioNode,
  notes: number[],
  p: SynthParams,
  oscs: OscillatorNode[],
): void {
  const per = notes.length > 1 ? 4 : 7;
  const spread = 4 + p.tone * 46; // cents
  const g = ctx.createGain();
  g.gain.value = 0.5 / Math.sqrt(per);
  g.connect(dest);
  for (const note of notes) {
    const f = midiToFreq(note);
    for (let i = 0; i < per; i++) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = spread * ((i / (per - 1)) * 2 - 1);
      o.connect(g);
      oscs.push(o);
    }
  }
}

function buildFm(
  ctx: AudioContext,
  dest: AudioNode,
  notes: number[],
  t: number,
  accent: boolean,
  p: SynthParams,
  oscs: OscillatorNode[],
): void {
  const algo = FM_ALGOS[p.algo] ?? FM_ALGOS[0]!;
  const ratio = FM_RATIOS[p.ratio] ?? 1;
  const index = p.tone * 6 + (accent ? 1.5 : 0);
  const tc = decayTc(p.decay);
  const carrierGain = ctx.createGain();
  carrierGain.gain.value = 0.6 / algo.carriers.length;
  carrierGain.connect(dest);
  const isMod = new Set(algo.mods.map(([m]) => m));
  for (const note of notes) {
    const f = midiToFreq(note);
    const ops = algo.ratios.map((r, i) => {
      const o = ctx.createOscillator();
      o.frequency.value = f * r * (isMod.has(i) ? ratio : 1);
      oscs.push(o);
      return o;
    });
    for (const [m, target] of algo.mods) {
      const depth = ctx.createGain();
      const amt = index * ops[m]!.frequency.value;
      // Modulation index decays a little faster than the amp: bright attack, mellow tail.
      depth.gain.setValueAtTime(amt, t);
      depth.gain.setTargetAtTime(amt * 0.25, t + 0.005, tc * 0.7);
      ops[m]!.connect(depth).connect(ops[target]!.frequency);
    }
    for (const c of algo.carriers) ops[c]!.connect(carrierGain);
  }
}
