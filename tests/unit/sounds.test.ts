import { describe, expect, it } from 'vitest';
import { FM_ALGOS } from '../../src/data/fm';
import { DRUM_KEYS, NOTE_KEYS } from '../../src/data/keymap';
import { defaultSound, sanitizeSound } from '../../src/data/sounds';
import { tuneFactor } from '../../src/audio/drums';
import { defaultSettings, load, sanitize, save, STORAGE_KEY } from '../../src/state';

describe('FM algorithms', () => {
  it.each(FM_ALGOS.map((a, i) => [i, a] as const))(
    'algorithm %i is feed-forward and complete',
    (_, a) => {
      expect(a.carriers.length).toBeGreaterThan(0);
      expect(a.ratios).toHaveLength(4);
      const used = new Set<number>(a.carriers);
      for (const [m, t] of a.mods) {
        expect(m).toBeGreaterThan(t);
        expect(a.carriers).not.toContain(m);
        used.add(m);
      }
      // Every operator either sounds or modulates something.
      expect(used.size).toBe(4);
    },
  );
});

describe('sound params', () => {
  it('sanitize keeps valid values and repairs junk', () => {
    const s = defaultSound();
    s.synths.lead.engine = 'fm';
    s.synths.lead.algo = 5;
    s.drums.kick.tune = 0.2;
    expect(sanitizeSound(JSON.parse(JSON.stringify(s)))).toEqual(s);
    const junk = sanitizeSound({ synths: { bass: { engine: 'tb', cutoff: 'x', algo: 99 } } });
    expect(junk.synths.bass).toEqual(defaultSound().synths.bass);
  });
  it('drum tune spans ±1 octave', () => {
    expect(tuneFactor(0.5)).toBe(1);
    expect(tuneFactor(0)).toBe(0.5);
    expect(tuneFactor(1)).toBe(2);
  });
});

describe('key map', () => {
  it('note keys cover a chromatic run without gaps', () => {
    const vals = Object.values(NOTE_KEYS).sort((a, b) => a - b);
    expect(vals).toEqual([...Array(vals.length).keys()]);
  });
  it('note, drum and FX keys never overlap', () => {
    for (const k of Object.keys(DRUM_KEYS)) expect(k in NOTE_KEYS).toBe(false);
    for (const k of '1234567890-=') {
      expect(k in NOTE_KEYS).toBe(false);
      expect(k in DRUM_KEYS).toBe(false);
    }
  });
});

describe('settings', () => {
  it('round-trips through storage', () => {
    const mem = new Map<string, string>();
    const storage = {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, v),
    };
    const s = defaultSettings('trance-gate');
    s.mutes = ['kick'];
    save(s, storage);
    expect(mem.has(STORAGE_KEY)).toBe(true);
    expect(load(storage)).toEqual(s);
  });
  it('falls back to defaults on garbage', () => {
    expect(sanitize('nope')).toEqual(defaultSettings());
    const s = sanitize({ bpm: 9999, swing: 10, loopId: 'x', mutes: ['kick', 'banjo'] });
    expect(s.bpm).toBe(220);
    expect(s.swing).toBe(50);
    expect(s.loopId).toBe('acid-techno');
    expect(s.mutes).toEqual(['kick']);
  });
});
