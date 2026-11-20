import { CHORDS, clamp } from './notes';
import { DRUM_IDS, SYNTH_IDS, type DrumId, type SynthTrackId } from './pattern';
import { FM_ALGOS } from './fm';

export const ENGINES = [
  { id: 'acid', label: 'Acid' },
  { id: 'fm', label: 'FM' },
  { id: 'saw', label: 'Supersaw' },
] as const;
export type EngineId = (typeof ENGINES)[number]['id'];

/** All values 0..1 (tune: 0.5 = neutral). */
export interface DrumParams {
  level: number;
  tune: number;
  decay: number;
}

export interface SynthParams {
  engine: EngineId;
  level: number;
  cutoff: number;
  reso: number;
  /** Filter envelope amount. */
  envMod: number;
  decay: number;
  /** Engine character: acid = saw→square, FM = modulation index, supersaw = detune spread. */
  tone: number;
  /** FM algorithm index. */
  algo: number;
  /** FM modulator ratio index (see FM_RATIOS). */
  ratio: number;
  /** Chord shape index (FM and supersaw only; acid is monophonic). */
  chord: number;
  /** Reverb/delay send. */
  space: number;
}

export interface Sound {
  drums: Record<DrumId, DrumParams>;
  synths: Record<SynthTrackId, SynthParams>;
}

export interface ParamDef<K extends string> {
  key: K;
  label: string;
}

export const DRUM_PARAMS: ParamDef<keyof DrumParams>[] = [
  { key: 'level', label: 'Level' },
  { key: 'tune', label: 'Tune' },
  { key: 'decay', label: 'Decay' },
];

export type SynthNumKey = Exclude<keyof SynthParams, 'engine' | 'algo' | 'ratio' | 'chord'>;
export const SYNTH_PARAMS: ParamDef<SynthNumKey>[] = [
  { key: 'level', label: 'Level' },
  { key: 'cutoff', label: 'Cutoff' },
  { key: 'reso', label: 'Reso' },
  { key: 'envMod', label: 'Env' },
  { key: 'decay', label: 'Decay' },
  { key: 'tone', label: 'Tone' },
  { key: 'space', label: 'Space' },
];

export const DEFAULT_DRUM: DrumParams = { level: 0.8, tune: 0.5, decay: 0.5 };

export const DEFAULT_SYNTH: Record<SynthTrackId, SynthParams> = {
  bass: {
    engine: 'acid',
    level: 0.75,
    cutoff: 0.35,
    reso: 0.7,
    envMod: 0.6,
    decay: 0.4,
    tone: 0.1,
    algo: 0,
    ratio: 1,
    chord: 0,
    space: 0,
  },
  lead: {
    engine: 'saw',
    level: 0.55,
    cutoff: 0.6,
    reso: 0.2,
    envMod: 0.4,
    decay: 0.5,
    tone: 0.5,
    algo: 0,
    ratio: 2,
    chord: 1,
    space: 0.35,
  },
};

export function defaultSound(): Sound {
  const drums = {} as Record<DrumId, DrumParams>;
  for (const id of DRUM_IDS) drums[id] = { ...DEFAULT_DRUM };
  const synths = {} as Record<SynthTrackId, SynthParams>;
  for (const id of SYNTH_IDS) synths[id] = { ...DEFAULT_SYNTH[id] };
  return { drums, synths };
}

const num = (v: unknown, d: number) =>
  typeof v === 'number' && Number.isFinite(v) ? clamp(v, 0, 1) : d;
const idx = (v: unknown, d: number, n: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < n ? v : d;

export function sanitizeSound(raw: unknown): Sound {
  const r = (raw ?? {}) as Partial<Sound>;
  const s = defaultSound();
  for (const id of DRUM_IDS) {
    const d = r.drums?.[id];
    if (d) for (const { key } of DRUM_PARAMS) s.drums[id][key] = num(d[key], s.drums[id][key]);
  }
  for (const id of SYNTH_IDS) {
    const d = r.synths?.[id];
    if (!d) continue;
    const t = s.synths[id];
    for (const { key } of SYNTH_PARAMS) t[key] = num(d[key], t[key]);
    if (ENGINES.some((e) => e.id === d.engine)) t.engine = d.engine as EngineId;
    t.algo = idx(d.algo, t.algo, FM_ALGOS.length);
    t.ratio = idx(d.ratio, t.ratio, FM_RATIOS.length);
    t.chord = idx(d.chord, t.chord, CHORDS.length);
  }
  return s;
}

/** Modulator frequency ratios selectable on the FM engine. */
export const FM_RATIOS = [0.5, 1, 2, 3, 4, 5, 7] as const;
