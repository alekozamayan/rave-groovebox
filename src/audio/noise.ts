const cache = new WeakMap<BaseAudioContext, AudioBuffer>();

/** A 1-second white-noise buffer, shared per context. */
export function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buf = cache.get(ctx);
  if (!buf) {
    buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    cache.set(ctx, buf);
  }
  return buf;
}

export function noiseSource(ctx: BaseAudioContext, loop = false): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = loop;
  return src;
}

/** A synthetic room impulse response for a light reverb. */
export function impulseResponse(ctx: BaseAudioContext, seconds = 1.6, decay = 3): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
  }
  return buf;
}
