import { buildLoop, getLoop, LOOPS } from './data/loops';
import { sanitizePattern, TRACK_IDS, type Pattern, type TrackId } from './data/pattern';
import { sanitizeSound, type Sound } from './data/sounds';
import { clamp } from './data/notes';

export interface Settings {
  loopId: string;
  bpm: number;
  swing: number;
  volume: number;
  pattern: Pattern;
  sound: Sound;
  mutes: TrackId[];
}

export const STORAGE_KEY = 'groovebox.settings.v1';
export const DEFAULT_LOOP = 'acid-techno';

export function defaultSettings(loopId = DEFAULT_LOOP): Settings {
  const preset = getLoop(loopId);
  const { pattern, sound } = buildLoop(preset);
  return {
    loopId: preset.id,
    bpm: preset.bpm,
    swing: preset.swing,
    volume: 0.8,
    pattern,
    sound,
    mutes: [],
  };
}

export function sanitize(raw: unknown): Settings {
  const d = defaultSettings();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<Settings>;
  const n = (v: unknown, lo: number, hi: number, def: number) =>
    typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : def;
  return {
    loopId: LOOPS.some((l) => l.id === r.loopId) ? (r.loopId as string) : d.loopId,
    bpm: Math.round(n(r.bpm, 40, 220, d.bpm)),
    swing: Math.round(n(r.swing, 50, 75, d.swing)),
    volume: n(r.volume, 0, 1, d.volume),
    pattern: r.pattern ? sanitizePattern(r.pattern) : d.pattern,
    sound: r.sound ? sanitizeSound(r.sound) : d.sound,
    mutes: Array.isArray(r.mutes) ? r.mutes.filter((m): m is TrackId => TRACK_IDS.includes(m)) : [],
  };
}

export function load(
  storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage,
): Settings {
  try {
    const s = storage?.getItem(STORAGE_KEY);
    return s ? sanitize(JSON.parse(s)) : defaultSettings();
  } catch {
    return defaultSettings();
  }
}

export function save(
  s: Settings,
  storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage,
): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* private mode / quota: settings just aren't remembered */
  }
}
