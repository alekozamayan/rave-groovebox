import { QUANTIZED, type FxId } from '../data/fx';
import {
  DRUM_IDS,
  isDrum,
  SYNTH_IDS,
  TRACK_IDS,
  type DrumId,
  type Pattern,
  type SynthTrackId,
  type TrackId,
} from '../data/pattern';
import type { Sound, SynthParams } from '../data/sounds';
import { Clock } from './clock';
import { DrumKit } from './drums';
import { stepEvents, type TrigEvent } from './events';
import { FxChain } from './fx';
import { impulseResponse } from './noise';
import { AcidVoice, playPoly, type Held } from './synths';

declare global {
  interface Navigator {
    /** iOS 17+ Safari: Audio Session API. */
    audioSession?: { type: string };
  }
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

/** Opt into the "playback" audio session so sound plays with the ring/silent switch on silent. */
export function setPlaybackAudioSession(nav: Navigator = navigator): boolean {
  try {
    if (nav.audioSession) {
      nav.audioSession.type = 'playback';
      return true;
    }
  } catch {
    /* not supported */
  }
  return false;
}

/** One synth lane: a persistent mono acid voice plus polyphonic FM/supersaw notes. */
class SynthTrack {
  private acid: AcidVoice | null = null;
  private live = new Map<string, Held>();
  private stack: { key: string; note: number }[] = [];

  constructor(
    private readonly ctx: AudioContext,
    readonly out: GainNode,
  ) {}

  private acidVoice(): AcidVoice {
    this.acid ??= new AcidVoice(this.ctx, this.out);
    return this.acid;
  }

  trigger(ev: TrigEvent, p: SynthParams): void {
    const spec = {
      time: ev.time,
      note: ev.note,
      gate: ev.gate,
      accent: ev.accent,
      legato: ev.legato,
    };
    const n = ev.cutoff === undefined ? spec : { ...spec, cutoff: ev.cutoff };
    if (p.engine === 'acid') this.acidVoice().play(n, p);
    else playPoly(this.ctx, this.out, { ...n, legato: false }, p);
  }

  noteOn(key: string, note: number, p: SynthParams): void {
    const time = this.ctx.currentTime;
    this.noteOff(key);
    if (p.engine === 'acid') {
      this.stack.push({ key, note });
      const legato = this.stack.length > 1;
      this.acidVoice().play({ time, note, gate: null, accent: false, legato }, p);
    } else {
      this.live.set(
        key,
        playPoly(this.ctx, this.out, { time, note, gate: null, accent: false, legato: false }, p),
      );
    }
  }

  noteOff(key: string): void {
    const t = this.ctx.currentTime;
    const held = this.live.get(key);
    if (held) {
      held.release(t);
      this.live.delete(key);
    }
    const i = this.stack.findIndex((s) => s.key === key);
    if (i < 0) return;
    const wasTop = i === this.stack.length - 1;
    this.stack.splice(i, 1);
    if (!wasTop) return;
    const prev = this.stack[this.stack.length - 1];
    if (prev && this.lastParams)
      this.acidVoice().play(
        { time: t, note: prev.note, gate: null, accent: false, legato: true },
        this.lastParams,
      );
    else this.acid?.release(t);
  }

  lastParams: SynthParams | null = null;

  allOff(): void {
    for (const k of [...this.live.keys()]) this.noteOff(k);
    this.stack = [];
    this.acid?.release(this.ctx.currentTime);
  }
}

export interface EngineState {
  pattern: Pattern;
  sound: Sound;
  bpm: number;
  swing: number;
  mutes: Set<TrackId>;
  volume: number;
}

export class AudioEngine {
  ctx: AudioContext | null = null;
  private clock: Clock | null = null;
  private kit: DrumKit | null = null;
  private synths = {} as Record<SynthTrackId, SynthTrack>;
  private trackGain = {} as Record<TrackId, GainNode>;
  private sends = {} as Record<SynthTrackId, GainNode>;
  private master!: GainNode;
  fx: FxChain | null = null;
  private pending: Pattern | null = null;
  /** Recently scheduled steps, for the playhead and live recording. */
  private scheduled: { step: number; time: number }[] = [];
  /** Called (on the UI thread, roughly in time with the audio) when a step plays. */
  onStep?: (step: number) => void;

  constructor(readonly state: EngineState) {}

  get started(): boolean {
    return this.ctx !== null;
  }

  get running(): boolean {
    return this.clock?.running ?? false;
  }

  /**
   * Create or resume the AudioContext. MUST be called synchronously inside a
   * user gesture handler (iOS Safari requirement).
   */
  unlock(): Promise<void> {
    setPlaybackAudioSession();
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? window.webkitAudioContext;
      if (!Ctor) return Promise.reject(new Error('Web Audio not supported'));
      this.ctx = new Ctor({ latencyHint: 'interactive' });
      this.build(this.ctx);
    }
    const ctx = this.ctx;
    // Play one silent sample: unlocks output on older iOS versions.
    const b = ctx.createBufferSource();
    b.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    b.connect(ctx.destination);
    b.start(0);
    return ctx.state === 'running' ? Promise.resolve() : ctx.resume();
  }

  private build(ctx: AudioContext): void {
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.08;
    // The compressor reacts after its attack, so leave headroom behind it too.
    const out = ctx.createGain();
    out.gain.value = 0.85;
    limiter.connect(out).connect(ctx.destination);
    const glue = ctx.createDynamicsCompressor();
    glue.threshold.value = -16;
    glue.ratio.value = 3;
    glue.attack.value = 0.01;
    glue.release.value = 0.15;
    glue.connect(limiter);
    this.master = ctx.createGain();
    this.master.connect(glue);

    this.fx = new FxChain(ctx, () => this.clock?.stepDur ?? 0.125);
    this.fx.output.connect(this.master);

    const verb = ctx.createConvolver();
    verb.buffer = impulseResponse(ctx, 2.4, 2.5);
    const verbOut = ctx.createGain();
    verbOut.gain.value = 0.6;
    verb.connect(verbOut).connect(this.fx.input);

    const drumOuts = {} as Record<DrumId, GainNode>;
    for (const id of TRACK_IDS) {
      const g = ctx.createGain();
      g.connect(this.fx.input);
      this.trackGain[id] = g;
      if (isDrum(id)) drumOuts[id] = g;
    }
    this.kit = new DrumKit(ctx, drumOuts);
    for (const id of SYNTH_IDS) {
      const pre = ctx.createGain();
      pre.connect(this.trackGain[id]);
      const send = ctx.createGain();
      pre.connect(send).connect(verb);
      this.sends[id] = send;
      this.synths[id] = new SynthTrack(ctx, pre);
    }

    this.clock = new Clock({
      now: () => ctx.currentTime,
      onStep: (s, t, d) => this.playStep(s, t, d),
    });
    this.clock.setTempo(this.state.bpm);
    this.clock.setSwing(this.state.swing);
    this.clock.length = this.state.pattern.length;
    this.applyMix();
  }

  /** Push level/send/volume settings to the graph. */
  applyMix(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    this.master.gain.setTargetAtTime(this.state.volume * 0.6, t, 0.02);
    for (const id of DRUM_IDS)
      this.trackGain[id].gain.setTargetAtTime(this.state.sound.drums[id].level, t, 0.02);
    for (const id of SYNTH_IDS) {
      const p = this.state.sound.synths[id];
      this.trackGain[id].gain.setTargetAtTime(p.level, t, 0.02);
      this.sends[id].gain.setTargetAtTime(p.space * 0.8, t, 0.02);
      this.synths[id].lastParams = p;
    }
  }

  private playStep(step: number, time: number, dur: number): void {
    if (step === 0 && this.pending) {
      this.state.pattern = this.pending;
      this.pending = null;
      this.onPatternSwap?.();
    }
    if (this.clock) this.clock.length = this.state.pattern.length;
    const events = stepEvents(this.state.pattern, step, time, dur, {
      muted: (id) => this.state.mutes.has(id),
    });
    for (const ev of events) this.trigger(ev);
    this.scheduled.push({ step, time });
    if (this.scheduled.length > 16) this.scheduled.shift();
    const ctx = this.ctx!;
    const delay = Math.max(0, (time - ctx.currentTime) * 1000);
    setTimeout(() => this.onStep?.(step), delay);
  }

  /** Called when a queued pattern takes over at the loop start. */
  onPatternSwap?: () => void;

  private trigger(ev: TrigEvent): void {
    const id = ev.track;
    if (isDrum(id)) this.kit?.play(id, ev.time, ev.accent, this.state.sound.drums[id]);
    else this.synths[id].trigger(ev, this.state.sound.synths[id]);
  }

  setTempo(bpm: number): void {
    this.state.bpm = bpm;
    this.clock?.setTempo(bpm);
  }

  setSwing(swing: number): void {
    this.state.swing = swing;
    this.clock?.setSwing(swing);
  }

  start(): void {
    this.clock?.start();
  }

  stop(): void {
    this.clock?.stop();
    if (this.pending) {
      this.state.pattern = this.pending;
      this.pending = null;
    }
    this.scheduled = [];
    const t = this.ctx?.currentTime ?? 0;
    this.fx?.releaseAll(t);
  }

  /** Switch pattern: at the next loop start while running, immediately otherwise. */
  queuePattern(p: Pattern): boolean {
    if (this.running) {
      this.pending = p;
      return true;
    }
    this.state.pattern = p;
    return false;
  }

  /** The step that is sounding now, rounded to the nearest 16th (for live recording). */
  nearestStep(): number | undefined {
    const ctx = this.ctx;
    if (!ctx || !this.running || !this.clock) return undefined;
    const now = ctx.currentTime;
    const dur = this.clock.stepDur;
    let best: { step: number; time: number } | undefined;
    for (const s of this.scheduled) if (s.time <= now + dur / 2) best = s;
    return best?.step;
  }

  noteOn(key: string, track: SynthTrackId, note: number): void {
    if (!this.ctx) return;
    this.synths[track].noteOn(key, note, this.state.sound.synths[track]);
  }

  noteOff(key: string, track: SynthTrackId): void {
    this.synths[track]?.noteOff(key);
  }

  allNotesOff(): void {
    for (const id of SYNTH_IDS) this.synths[id]?.allOff();
  }

  hitDrum(id: DrumId, accent = true): void {
    if (!this.ctx) return;
    this.kit?.play(id, this.ctx.currentTime, accent, this.state.sound.drums[id]);
  }

  /** Engage a punch-in FX; returns the audio time it starts (quantized while running). */
  fxOn(id: FxId): void {
    const ctx = this.ctx;
    if (!ctx || !this.fx || !this.clock) return;
    const now = ctx.currentTime;
    const t = QUANTIZED.has(id) ? this.clock.nextGrid(now + 0.005) : now;
    this.fx.engage(id, t);
  }

  fxOff(id: FxId): void {
    const ctx = this.ctx;
    if (!ctx || !this.fx) return;
    this.fx.release(id, ctx.currentTime);
  }
}
