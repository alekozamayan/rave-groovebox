import { describe, expect, it } from 'vitest';
import { CHORDS, midiToFreq, noteName, parseNote } from '../../src/data/notes';

describe('notes', () => {
  it('converts MIDI to frequency', () => {
    expect(midiToFreq(69)).toBe(440);
    expect(midiToFreq(57)).toBeCloseTo(220);
    expect(midiToFreq(60)).toBeCloseTo(261.626, 2);
  });
  it('names and parses notes round-trip', () => {
    expect(noteName(60)).toBe('C4');
    expect(noteName(33)).toBe('A1');
    expect(parseNote('A1')).toBe(33);
    expect(parseNote('D#2')).toBe(39);
    expect(parseNote('Eb2')).toBe(39);
    expect(parseNote('H2')).toBeUndefined();
    for (let m = 12; m < 108; m++) expect(parseNote(noteName(m))).toBe(m);
  });
  it('chords start on the root and ascend', () => {
    for (const c of CHORDS) {
      expect(c.notes[0]).toBe(0);
      for (let i = 1; i < c.notes.length; i++) expect(c.notes[i]!).toBeGreaterThan(c.notes[i - 1]!);
    }
  });
});
