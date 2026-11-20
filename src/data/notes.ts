/** 12-TET note helpers. MIDI note 69 = A4 = 440 Hz. */

export const NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
] as const;

export function midiToFreq(midi: number, a4 = 440): number {
  return a4 * 2 ** ((midi - 69) / 12);
}

/** 36 -> "C2" (MIDI 60 = C4). */
export function noteName(midi: number): string {
  const pc = ((midi % 12) + 12) % 12;
  return `${NOTE_NAMES[pc]}${Math.floor(midi / 12) - 1}`;
}

/** "C2" / "D#3" / "Bb1" -> MIDI number, or undefined when malformed. */
export function parseNote(s: string): number | undefined {
  const m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(s.trim());
  if (!m) return undefined;
  const base = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }[m[1]!.toLowerCase() as 'c'];
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return (Number(m[3]) + 1) * 12 + base + acc;
}

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Chord shapes (semitones above the root) for the polyphonic engines. */
export const CHORDS = [
  { id: 'off', label: 'Single', notes: [0] },
  { id: 'min', label: 'Minor', notes: [0, 3, 7] },
  { id: 'maj', label: 'Major', notes: [0, 4, 7] },
  { id: 'min7', label: 'Min 7', notes: [0, 3, 7, 10] },
  { id: 'fifth', label: 'Fifths', notes: [0, 7, 12] },
  { id: 'sus', label: 'Sus 4', notes: [0, 5, 7] },
] as const;
