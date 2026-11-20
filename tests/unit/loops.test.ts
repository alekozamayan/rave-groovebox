import { describe, expect, it } from 'vitest';
import { buildLoop, GENRES, getLoop, LOOPS } from '../../src/data/loops';
import { DRUM_IDS, parseDrum, parseSynth, SYNTH_IDS } from '../../src/data/pattern';

describe('rave loop library', () => {
  it('has unique ids and known genres', () => {
    const ids = LOOPS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const l of LOOPS) expect(GENRES).toContain(l.genre);
    expect(LOOPS.length).toBeGreaterThanOrEqual(10);
  });

  for (const l of LOOPS) {
    describe(l.name, () => {
      it('has sane tempo and swing', () => {
        expect(l.bpm).toBeGreaterThanOrEqual(60);
        expect(l.bpm).toBeLessThanOrEqual(200);
        expect(l.swing).toBeGreaterThanOrEqual(50);
        expect(l.swing).toBeLessThanOrEqual(75);
      });
      it('lines are 16 steps or the pattern length', () => {
        for (const id of DRUM_IDS) {
          const line = l.drums[id];
          if (line) expect([16, l.length]).toContain(parseDrum(line).length);
        }
        for (const id of SYNTH_IDS) {
          const line = l.synths[id];
          if (line) expect([16, l.length]).toContain(parseSynth(line).length);
        }
      });
      it('notes sit in each lane’s range', () => {
        const range = { bass: [21, 60], lead: [40, 96] } as const;
        for (const id of SYNTH_IDS) {
          for (const s of parseSynth(l.synths[id] ?? '-')) {
            if (!s.on) continue;
            expect(s.note).toBeGreaterThanOrEqual(range[id][0]);
            expect(s.note).toBeLessThanOrEqual(range[id][1]);
          }
        }
      });
      it('closed hat never lands on an open hat (it would choke it)', () => {
        const { pattern } = buildLoop(l);
        pattern.tracks.ohh.forEach((s, i) => {
          if (s.on) expect(pattern.tracks.chh[i]!.on).toBe(false);
        });
      });
      it('builds a pattern with sound overrides applied', () => {
        const { pattern, sound } = buildLoop(l);
        expect(pattern.length).toBe(l.length);
        for (const id of SYNTH_IDS) {
          const over = l.sound?.synths?.[id];
          if (over) expect(sound.synths[id]).toMatchObject(over);
        }
      });
    });
  }

  it('falls back to the first loop for unknown ids', () => {
    expect(getLoop('nope')).toBe(LOOPS[0]);
  });
});
