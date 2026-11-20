import { describe, expect, it } from 'vitest';
import {
  crushCurve,
  cutoffHz,
  driveCurve,
  pitchFactor,
  tapeStopCurve,
} from '../../src/audio/fxmath';
import { FX_DEFS, QUANTIZED, REPEAT_STEPS } from '../../src/data/fx';

describe('punch-in FX table', () => {
  it('has 12 pads with unique ids and keys', () => {
    expect(FX_DEFS).toHaveLength(12);
    expect(new Set(FX_DEFS.map((f) => f.id)).size).toBe(12);
    expect(new Set(FX_DEFS.map((f) => f.key)).size).toBe(12);
  });
  it('beat repeats are quantized and halve in length', () => {
    expect(REPEAT_STEPS).toEqual({ rep4: 4, rep8: 2, rep16: 1, rep32: 0.5 });
    for (const id of Object.keys(REPEAT_STEPS)) expect(QUANTIZED.has(id as never)).toBe(true);
  });
});

describe('FX math', () => {
  it('tape stop slows pitch linearly from 1 to 0', () => {
    const T = 1;
    const c = tapeStopCurve(T, 101);
    expect(c[0]).toBe(0);
    expect(c[100]).toBeCloseTo(T / 2);
    const dt = T / 100;
    expect(pitchFactor(c[1]! - c[0]!, dt)).toBeCloseTo(1, 1);
    expect(pitchFactor(c[51]! - c[50]!, dt)).toBeCloseTo(0.5, 1);
    expect(pitchFactor(c[100]! - c[99]!, dt)).toBeCloseTo(0, 1);
  });
  it('crush curve has 2^bits levels and is odd-symmetric', () => {
    const c = crushCurve(3, 1001);
    expect(new Set(Array.from(c)).size).toBe(9);
    expect(c[0]).toBe(-1);
    expect(c[1000]).toBe(1);
    expect(c[500]).toBe(0);
  });
  it('drive curve is bounded and monotonic', () => {
    const c = driveCurve(0.5);
    expect(c[0]).toBeCloseTo(-1);
    expect(c[c.length - 1]).toBeCloseTo(1);
    for (let i = 1; i < c.length; i++) expect(c[i]!).toBeGreaterThanOrEqual(c[i - 1]!);
  });
  it('cutoff spans ~60 Hz to ~19 kHz', () => {
    expect(cutoffHz(0)).toBe(60);
    expect(cutoffHz(1)).toBeGreaterThan(18000);
    expect(cutoffHz(2)).toBe(cutoffHz(1));
  });
});
