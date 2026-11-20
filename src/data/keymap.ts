import { DRUM_IDS, type DrumId } from './pattern';

/** DAW-style computer keyboard: A row = white keys, W row = black keys (semitones from C). */
export const NOTE_KEYS: Record<string, number> = {
  a: 0,
  w: 1,
  s: 2,
  e: 3,
  d: 4,
  f: 5,
  t: 6,
  g: 7,
  y: 8,
  h: 9,
  u: 10,
  j: 11,
  k: 12,
  o: 13,
  l: 14,
  p: 15,
  ';': 16,
  "'": 17,
};

/** Bottom row plays the drum pads. */
export const DRUM_KEYS: Record<string, DrumId> = Object.fromEntries(
  ['z', 'x', 'c', 'v', 'b', 'n'].map((k, i) => [k, DRUM_IDS[i]!]),
) as Record<string, DrumId>;

export const OCTAVE_DOWN = '[';
export const OCTAVE_UP = ']';

/** Number of keys on the on-screen keyboard (2 octaves + top C). */
export const VISIBLE_KEYS = 25;
const BLACK = new Set([1, 3, 6, 8, 10]);
export const isBlack = (semitone: number): boolean => BLACK.has(((semitone % 12) + 12) % 12);
