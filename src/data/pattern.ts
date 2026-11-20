import { clamp, parseNote } from './notes';

/** Drum lanes, in display order. */
export const DRUM_IDS = ['kick', 'snare', 'clap', 'chh', 'ohh', 'ride'] as const;
export type DrumId = (typeof DRUM_IDS)[number];

/** Synth lanes. */
export const SYNTH_IDS = ['bass', 'lead'] as const;
export type SynthTrackId = (typeof SYNTH_IDS)[number];

export type TrackId = DrumId | SynthTrackId;
export const TRACK_IDS: readonly TrackId[] = [...DRUM_IDS, ...SYNTH_IDS];

export const isDrum = (id: TrackId): id is DrumId => (DRUM_IDS as readonly string[]).includes(id);

export type Ratchet = 1 | 2 | 3 | 4;
export const PROBS = [1, 0.75, 0.5, 0.25] as const;

export interface Step {
  on: boolean;
  accent: boolean;
  /** Chance the step plays, 0..1. */
  prob: number;
  /** Retrigger the step this many times inside its duration. */
  ratchet: Ratchet;
  /** MIDI note (synth lanes only). */
  note: number;
  /** Hold into the next step and glide to its pitch (synth lanes only). */
  slide: boolean;
  /** Parameter lock: filter cutoff 0..1 for this step only (synth lanes). */
  cutoff?: number;
}

export const LENGTHS = [16, 32] as const;
export type PatternLength = (typeof LENGTHS)[number];

export interface Pattern {
  length: PatternLength;
  tracks: Record<TrackId, Step[]>;
}

export const DEFAULT_NOTE: Record<SynthTrackId, number> = { bass: 36, lead: 60 };

export function emptyStep(note = 48): Step {
  return { on: false, accent: false, prob: 1, ratchet: 1, note, slide: false };
}

export function emptyPattern(length: PatternLength = 16): Pattern {
  const tracks = {} as Record<TrackId, Step[]>;
  for (const id of TRACK_IDS) {
    const note = isDrum(id) ? 48 : DEFAULT_NOTE[id];
    tracks[id] = Array.from({ length: 32 }, () => emptyStep(note));
  }
  return { length, tracks };
}

/**
 * Drum notation, one character per 16th step:
 *  `.` rest, `x` hit, `X` accented hit, `?` 50% chance hit, `2`/`3`/`4` ratchet hit.
 */
export function parseDrum(s: string): Step[] {
  return [...s.replace(/\s|\|/g, '')].map((c) => {
    const step = emptyStep();
    if (c === '.' || c === '-') return step;
    step.on = true;
    if (c === 'X') step.accent = true;
    else if (c === '?') step.prob = 0.5;
    else if (c === '2' || c === '3' || c === '4') step.ratchet = Number(c) as Ratchet;
    else if (c !== 'x') throw new Error(`bad drum char "${c}" in "${s}"`);
    return step;
  });
}

/**
 * Synth notation, whitespace-separated tokens, one per 16th step:
 *  `-` rest, `C2` note, `C2!` accented, `C2~` slide into the next step, `C2!~` both.
 */
export function parseSynth(s: string): Step[] {
  return s
    .trim()
    .split(/\s+/)
    .filter((t) => t !== '|')
    .map((tok) => {
      if (tok === '-' || tok === '.') return emptyStep();
      const m = /^([A-Ga-g][#b]?-?\d)([!~]*)$/.exec(tok);
      const note = m ? parseNote(m[1]!) : undefined;
      if (!m || note === undefined) throw new Error(`bad synth token "${tok}" in "${s}"`);
      const step = emptyStep(note);
      step.on = true;
      step.accent = m[2]!.includes('!');
      step.slide = m[2]!.includes('~');
      return step;
    });
}

/** Fill the 32-step buffer by repeating `steps` (a 16-step line repeats twice). */
export function fit(steps: Step[]): Step[] {
  return Array.from({ length: 32 }, (_, i) =>
    steps.length ? { ...steps[i % steps.length]! } : emptyStep(),
  );
}

export function sanitizeStep(raw: unknown, fallbackNote: number): Step {
  const r = (raw ?? {}) as Partial<Step>;
  const step: Step = {
    on: r.on === true,
    accent: r.accent === true,
    prob: typeof r.prob === 'number' ? clamp(r.prob, 0, 1) : 1,
    ratchet: ([1, 2, 3, 4] as const).includes(r.ratchet as Ratchet) ? (r.ratchet as Ratchet) : 1,
    note:
      typeof r.note === 'number' && Number.isFinite(r.note)
        ? clamp(Math.round(r.note), 12, 108)
        : fallbackNote,
    slide: r.slide === true,
  };
  if (typeof r.cutoff === 'number' && Number.isFinite(r.cutoff))
    step.cutoff = clamp(r.cutoff, 0, 1);
  return step;
}

export function sanitizePattern(raw: unknown): Pattern {
  const r = (raw ?? {}) as Partial<Pattern>;
  const length: PatternLength = r.length === 32 ? 32 : 16;
  const p = emptyPattern(length);
  for (const id of TRACK_IDS) {
    const steps = r.tracks?.[id];
    if (!Array.isArray(steps)) continue;
    const note = isDrum(id) ? 48 : DEFAULT_NOTE[id];
    p.tracks[id] = Array.from({ length: 32 }, (_, i) => sanitizeStep(steps[i], note));
  }
  return p;
}
