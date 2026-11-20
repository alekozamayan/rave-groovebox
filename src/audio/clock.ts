export interface ClockOptions {
  /** Current audio clock time in seconds (audioContext.currentTime). */
  now: () => number;
  /** Schedule step `step` (0-based, wraps at `length`) at audio time `time`; `dur` = one 16th. */
  onStep: (step: number, time: number, dur: number) => void;
  /** How far ahead to schedule, seconds. */
  lookahead?: number;
  /** Timer period, ms. */
  intervalMs?: number;
  setInterval?: (fn: () => void, ms: number) => unknown;
  clearInterval?: (id: unknown) => void;
}

/** Duration of one 16th note at `bpm` (quarter-note BPM). */
export const stepDuration = (bpm: number): number => 60 / bpm / 4;

/**
 * MPC-style swing: odd 16ths are delayed. 50 = straight, 66 ≈ triplet shuffle, 75 = max.
 */
export function swingOffset(step: number, dur: number, swing: number): number {
  if (step % 2 === 0) return 0;
  const s = Math.min(75, Math.max(50, swing));
  return ((2 * s) / 100) * dur - dur;
}

/**
 * Look-ahead 16th-note clock ("a tale of two clocks"): a coarse JS timer wakes
 * up every few ms and schedules every step inside the look-ahead window on the
 * precise audio clock. Never schedules audio with raw setTimeout.
 */
export class Clock {
  bpm = 125;
  swing = 50;
  length = 16;
  private timer: unknown = null;
  /** Unswung grid time of the next step to schedule. */
  private gridTime = 0;
  private step = 0;
  private readonly lookahead: number;
  private readonly intervalMs: number;

  constructor(private readonly opts: ClockOptions) {
    this.lookahead = opts.lookahead ?? 0.12;
    this.intervalMs = opts.intervalMs ?? 25;
  }

  get running(): boolean {
    return this.timer !== null;
  }

  get stepDur(): number {
    return stepDuration(this.bpm);
  }

  setTempo(bpm: number): void {
    this.bpm = Math.min(220, Math.max(40, bpm));
  }

  setSwing(swing: number): void {
    this.swing = Math.min(75, Math.max(50, swing));
  }

  start(): void {
    if (this.running) return;
    this.step = 0;
    this.gridTime = this.opts.now() + 0.05;
    const si = this.opts.setInterval ?? ((fn, ms) => globalThis.setInterval(fn, ms));
    this.timer = si(() => this.tick(), this.intervalMs);
    this.tick();
  }

  stop(): void {
    if (!this.running) return;
    const ci =
      this.opts.clearInterval ??
      ((id) => globalThis.clearInterval(id as ReturnType<typeof setInterval>));
    ci(this.timer);
    this.timer = null;
  }

  /** The first 16th-grid boundary at or after `t` (for quantizing punch-in FX). */
  nextGrid(t: number): number {
    if (!this.running) return t;
    const dur = this.stepDur;
    let g = this.gridTime;
    while (g - dur >= t - 1e-9) g -= dur;
    return g;
  }

  /** Schedule everything inside the look-ahead window. Public for testing. */
  tick(): void {
    const horizon = this.opts.now() + this.lookahead;
    while (this.gridTime < horizon) {
      if (this.step >= this.length) this.step = 0;
      const dur = this.stepDur;
      this.opts.onStep(this.step, this.gridTime + swingOffset(this.step, dur, this.swing), dur);
      this.gridTime += dur;
      this.step = (this.step + 1) % this.length;
    }
  }
}
