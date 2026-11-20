import { describe, expect, it } from 'vitest';
import { gateSteps, nextOn, prevOn, stepEvents } from '../../src/audio/events';
import { emptyPattern, fit, parseDrum, parseSynth } from '../../src/data/pattern';

const none = () => false;

describe('step events', () => {
  it('fires drums and synth notes on active steps', () => {
    const p = emptyPattern();
    p.tracks.kick = fit(parseDrum('x...x...x...x...'));
    p.tracks.bass = fit(parseSynth('A1 - - - - - - - - - - - - - - -'));
    const ev = stepEvents(p, 0, 1, 0.1, { muted: none });
    expect(ev.map((e) => e.track).sort()).toEqual(['bass', 'kick']);
    expect(stepEvents(p, 1, 1, 0.1, { muted: none })).toEqual([]);
  });

  it('skips muted tracks', () => {
    const p = emptyPattern();
    p.tracks.kick = fit(parseDrum('x'));
    expect(stepEvents(p, 0, 0, 0.1, { muted: (id) => id === 'kick' })).toEqual([]);
  });

  it('applies probability with the injected rng', () => {
    const p = emptyPattern();
    p.tracks.chh = fit(parseDrum('?'));
    expect(stepEvents(p, 0, 0, 0.1, { muted: none, rng: () => 0.4 })).toHaveLength(1);
    expect(stepEvents(p, 0, 0, 0.1, { muted: none, rng: () => 0.6 })).toHaveLength(0);
  });

  it('splits ratchets evenly inside the step', () => {
    const p = emptyPattern();
    p.tracks.snare = fit(parseDrum('4'));
    const ev = stepEvents(p, 0, 2, 0.2, { muted: none });
    expect(ev.map((e) => e.time)).toEqual([2, 2.05, 2.1, 2.15].map((x) => expect.closeTo(x)));
  });

  it('slides hold to the next note and make it legato', () => {
    const steps = fit(parseSynth('A1~ - - C2 - - - - - - - - - - - -'));
    expect(nextOn(steps, 0, 16)).toBe(3);
    expect(prevOn(steps, 3, 16)).toBe(0);
    expect(gateSteps(steps, 0, 16)).toBeCloseTo(3.1);
    expect(gateSteps(steps, 3, 16)).toBeCloseTo(0.55);
    const p = emptyPattern();
    p.tracks.bass = steps;
    const [a] = stepEvents(p, 0, 0, 0.1, { muted: none });
    const [b] = stepEvents(p, 3, 0.3, 0.1, { muted: none });
    expect(a!.legato).toBe(false);
    expect(a!.gate).toBeCloseTo(0.31);
    expect(b!.legato).toBe(true);
  });

  it('a slide on the last note wraps to the first', () => {
    const steps = fit(parseSynth('A1 - - - - - - - - - - - - - - C2~'));
    expect(gateSteps(steps, 15, 16)).toBeCloseTo(1.1);
  });

  it('carries cutoff locks', () => {
    const p = emptyPattern();
    p.tracks.lead[0] = { ...p.tracks.lead[0]!, on: true, cutoff: 0.2 };
    expect(stepEvents(p, 0, 0, 0.1, { muted: none })[0]!.cutoff).toBe(0.2);
  });
});
