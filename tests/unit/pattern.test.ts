import { describe, expect, it } from 'vitest';
import {
  emptyPattern,
  fit,
  parseDrum,
  parseSynth,
  sanitizePattern,
  TRACK_IDS,
} from '../../src/data/pattern';

describe('drum notation', () => {
  it('parses hits, accents, chance and ratchets', () => {
    const s = parseDrum('X.x? 2.3.4');
    expect(s).toHaveLength(9);
    expect(s[0]).toMatchObject({ on: true, accent: true });
    expect(s[1]!.on).toBe(false);
    expect(s[2]).toMatchObject({ on: true, accent: false, prob: 1 });
    expect(s[3]).toMatchObject({ on: true, prob: 0.5 });
    expect(s[4]!.ratchet).toBe(2);
    expect(s[6]!.ratchet).toBe(3);
    expect(s[8]!.ratchet).toBe(4);
  });
  it('rejects unknown characters', () => {
    expect(() => parseDrum('x.y.')).toThrow();
  });
});

describe('synth notation', () => {
  it('parses notes, rests, accents and slides', () => {
    const s = parseSynth('A1 - C2! D#2~ E2!~');
    expect(s.map((x) => x.on)).toEqual([true, false, true, true, true]);
    expect(s[0]!.note).toBe(33);
    expect(s[2]).toMatchObject({ accent: true, slide: false, note: 36 });
    expect(s[3]).toMatchObject({ accent: false, slide: true, note: 39 });
    expect(s[4]).toMatchObject({ accent: true, slide: true });
  });
  it('rejects bad tokens', () => {
    expect(() => parseSynth('A1 X9')).toThrow();
  });
});

describe('patterns', () => {
  it('fit repeats a 16-step line into 32 independent steps', () => {
    const out = fit(parseDrum('x...............'));
    expect(out).toHaveLength(32);
    expect(out[16]!.on).toBe(true);
    out[16]!.on = false;
    expect(out[0]!.on).toBe(true);
  });
  it('sanitize repairs junk and keeps valid data', () => {
    const p = emptyPattern(32);
    p.tracks.kick[3]!.on = true;
    p.tracks.bass[0] = { ...p.tracks.bass[0]!, on: true, note: 40, cutoff: 0.3, ratchet: 3 };
    const back = sanitizePattern(JSON.parse(JSON.stringify(p)));
    expect(back).toEqual(p);
    const junk = sanitizePattern({
      length: 99,
      tracks: { kick: [{ on: 'yes', prob: 7, ratchet: 9, note: 'C' }] },
    });
    expect(junk.length).toBe(16);
    expect(junk.tracks.kick[0]).toMatchObject({ on: false, prob: 1, ratchet: 1 });
    for (const id of TRACK_IDS) expect(junk.tracks[id]).toHaveLength(32);
  });
});
