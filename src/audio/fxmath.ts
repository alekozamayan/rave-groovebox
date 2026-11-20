/**
 * Delay-time curve for a tape stop over `seconds`: d(u) = u² / 2T, so the read
 * head slows linearly and the pitch factor (1 − d'(u)) falls from 1 to 0.
 */
export function tapeStopCurve(seconds: number, points = 64): Float32Array {
  const c = new Float32Array(points);
  for (let i = 0; i < points; i++) {
    const u = (i / (points - 1)) * seconds;
    c[i] = (u * u) / (2 * seconds);
  }
  return c;
}

/** Pitch factor of a delay line whose delay changes by `dDelay` over `dt`. */
export function pitchFactor(dDelay: number, dt: number): number {
  return 1 - dDelay / dt;
}

/** Waveshaper curve quantizing the signal to `bits` of resolution (bit crusher). */
export function crushCurve(bits: number, size = 4096): Float32Array {
  const levels = 2 ** Math.max(1, bits - 1);
  const c = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    const x = (i / (size - 1)) * 2 - 1;
    c[i] = Math.round(x * levels) / levels;
  }
  return c;
}

/** Soft-clip curve (tanh) for gentle drive. */
export function driveCurve(amount: number, size = 2048): Float32Array {
  const k = 1 + amount * 8;
  const c = new Float32Array(size);
  const norm = Math.tanh(k);
  for (let i = 0; i < size; i++) {
    const x = (i / (size - 1)) * 2 - 1;
    c[i] = Math.tanh(k * x) / norm;
  }
  return c;
}

/** Filter cutoff 0..1 → Hz on an exponential scale (60 Hz … ~19 kHz). */
export function cutoffHz(v: number): number {
  return 60 * 2 ** (Math.min(1, Math.max(0, v)) * 8.3);
}
