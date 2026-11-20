import { describe, expect, it } from 'vitest';
import { Clock, stepDuration, swingOffset } from '../../src/audio/clock';

function fakeClock() {
  let now = 0;
  const steps: { step: number; time: number }[] = [];
  const clock = new Clock({
    now: () => now,
    onStep: (step, time) => steps.push({ step, time }),
    setInterval: () => 1,
    clearInterval: () => {},
  });
  return { clock, steps, advance: (t: number) => (now += t) };
}

describe('clock', () => {
  it('step duration is a 16th of quarter-note BPM', () => {
    expect(stepDuration(120)).toBeCloseTo(0.125);
    expect(stepDuration(150)).toBeCloseTo(0.1);
  });

  it('swing delays only odd 16ths', () => {
    const d = 0.125;
    expect(swingOffset(0, d, 66)).toBe(0);
    expect(swingOffset(1, d, 50)).toBeCloseTo(0);
    expect(swingOffset(1, d, 66)).toBeCloseTo(0.32 * d);
    expect(swingOffset(3, d, 75)).toBeCloseTo(0.5 * d);
    expect(swingOffset(3, d, 99)).toBeCloseTo(0.5 * d);
  });

  it('schedules steps inside the look-ahead window and wraps at the length', () => {
    const { clock, steps, advance } = fakeClock();
    clock.setTempo(120);
    clock.length = 4;
    clock.start();
    const first = steps.length;
    expect(first).toBeGreaterThan(0);
    for (let i = 0; i < 40; i++) {
      advance(0.025);
      clock.tick();
    }
    expect(steps.map((s) => s.step).slice(0, 9)).toEqual([0, 1, 2, 3, 0, 1, 2, 3, 0]);
    for (let i = 1; i < steps.length; i++)
      expect(steps[i]!.time - steps[i - 1]!.time).toBeCloseTo(0.125);
    // Never schedules further ahead than the look-ahead.
    expect(steps[steps.length - 1]!.time).toBeLessThan(1 + 0.12 + 0.125);
  });

  it('applies swing to scheduled times', () => {
    const { clock, steps, advance } = fakeClock();
    clock.setTempo(120);
    clock.setSwing(75);
    clock.start();
    for (let i = 0; i < 8; i++) {
      advance(0.025);
      clock.tick();
    }
    const t0 = steps[0]!.time;
    expect(steps[1]!.time - t0).toBeCloseTo(0.125 * 1.5);
  });

  it('nextGrid snaps to the following 16th boundary', () => {
    const { clock, steps } = fakeClock();
    clock.setTempo(120);
    clock.start();
    const t0 = steps[0]!.time;
    expect(clock.nextGrid(t0 + 0.01)).toBeCloseTo(t0 + 0.125);
    expect(clock.nextGrid(t0)).toBeCloseTo(t0);
    clock.stop();
    expect(clock.nextGrid(3.3)).toBe(3.3);
  });

  it('clamps tempo', () => {
    const { clock } = fakeClock();
    clock.setTempo(1000);
    expect(clock.bpm).toBe(220);
    clock.setTempo(1);
    expect(clock.bpm).toBe(40);
  });
});
