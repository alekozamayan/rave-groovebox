import { isDrum, TRACK_IDS, type Pattern, type Step, type TrackId } from '../data/pattern';

export interface TrigEvent {
  track: TrackId;
  time: number;
  accent: boolean;
  note: number;
  /** Seconds the note is held. */
  gate: number;
  /** Glide from the previous note without re-triggering envelopes (acid slide). */
  legato: boolean;
  /** Per-step cutoff lock, 0..1. */
  cutoff?: number;
}

/** Index of the next `on` step after `i`, wrapping inside `length`, or -1. */
export function nextOn(steps: Step[], i: number, length: number): number {
  for (let k = 1; k <= length; k++) {
    const j = (i + k) % length;
    if (steps[j]?.on) return j;
  }
  return -1;
}

/** Index of the previous `on` step before `i`, wrapping inside `length`, or -1. */
export function prevOn(steps: Step[], i: number, length: number): number {
  for (let k = 1; k <= length; k++) {
    const j = (((i - k) % length) + length) % length;
    if (steps[j]?.on) return j;
  }
  return -1;
}

/** Gate of a synth step in 16ths: a slide holds until the next note (plus overlap). */
export function gateSteps(steps: Step[], i: number, length: number): number {
  const s = steps[i];
  if (!s?.slide) return 0.55;
  const j = nextOn(steps, i, length);
  const dist = j < 0 ? length : j > i ? j - i : j + length - i;
  return dist + 0.1;
}

export interface EventOptions {
  muted: (id: TrackId) => boolean;
  /** Random source in [0, 1), injectable for tests. */
  rng?: () => number;
}

/** All triggers for one 16th step of `pattern`, starting at `time` with step length `dur`. */
export function stepEvents(
  pattern: Pattern,
  step: number,
  time: number,
  dur: number,
  opts: EventOptions,
): TrigEvent[] {
  const rng = opts.rng ?? Math.random;
  const out: TrigEvent[] = [];
  const len = pattern.length;
  for (const id of TRACK_IDS) {
    const steps = pattern.tracks[id];
    const s = steps[step];
    if (!s?.on || opts.muted(id)) continue;
    if (s.prob < 1 && rng() >= s.prob) continue;
    const drum = isDrum(id);
    if (s.ratchet > 1) {
      const sub = dur / s.ratchet;
      for (let k = 0; k < s.ratchet; k++) {
        out.push({
          track: id,
          time: time + k * sub,
          accent: s.accent && k === 0,
          note: s.note,
          gate: sub * 0.5,
          legato: false,
          ...(s.cutoff !== undefined && { cutoff: s.cutoff }),
        });
      }
      continue;
    }
    const p = drum ? -1 : prevOn(steps, step, len);
    out.push({
      track: id,
      time,
      accent: s.accent,
      note: s.note,
      gate: drum ? dur * 0.5 : gateSteps(steps, step, len) * dur,
      legato: p >= 0 && p !== step && steps[p]!.slide && steps[p]!.ratchet === 1,
      ...(s.cutoff !== undefined && { cutoff: s.cutoff }),
    });
  }
  return out;
}
