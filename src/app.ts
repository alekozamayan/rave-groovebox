import { AudioEngine, type EngineState } from './audio/engine';
import { FX_DEFS, type FxId } from './data/fx';
import { FM_ALGOS } from './data/fm';
import { t } from './data/i18n';
import { DRUM_KEYS, NOTE_KEYS, OCTAVE_DOWN, OCTAVE_UP } from './data/keymap';
import { buildLoop, GENRES, getLoop, LOOPS } from './data/loops';
import { CHORDS, clamp, noteName } from './data/notes';
import {
  DEFAULT_NOTE,
  DRUM_IDS,
  emptyStep,
  isDrum,
  PROBS,
  TRACK_IDS,
  type DrumId,
  type Ratchet,
  type Step,
  type SynthTrackId,
  type TrackId,
} from './data/pattern';
import {
  DRUM_PARAMS,
  ENGINES,
  FM_RATIOS,
  SYNTH_PARAMS,
  type EngineId,
  type SynthParams,
} from './data/sounds';
import { load, save, type Settings } from './state';
import { h } from './ui/dom';
import { Keyboard } from './ui/keyboard';
import { HoldPads } from './ui/pads';

type Tab = 'seq' | 'sound' | 'keys' | 'fx';

function button(label: string, attrs: Record<string, string> = {}): HTMLButtonElement {
  return h('button', { type: 'button', ...attrs }, label);
}

function select<T extends string | number>(
  options: { value: T; label: string; group?: string }[],
  value: T,
  attrs: Record<string, string> = {},
): HTMLSelectElement {
  const el = h('select', attrs);
  const groups = new Map<string, HTMLOptGroupElement>();
  for (const o of options) {
    const opt = h('option', { value: String(o.value) }, o.label);
    if (o.group) {
      let g = groups.get(o.group);
      if (!g) {
        g = h('optgroup', { label: o.group });
        groups.set(o.group, g);
        el.append(g);
      }
      g.append(opt);
    } else el.append(opt);
  }
  el.value = String(value);
  return el;
}

function slider(label: string, value: number, onInput: (v: number) => void, testid?: string) {
  const input = h('input', {
    type: 'range',
    min: 0,
    max: 1,
    step: 0.01,
    value,
    'aria-label': label,
    ...(testid && { 'data-testid': testid }),
  });
  input.addEventListener('input', () => onInput(Number(input.value)));
  return h('label', { class: 'knob' }, h('span', {}, label), input);
}

export function mountApp(root: HTMLElement): void {
  const settings = load();
  const state: EngineState = {
    pattern: settings.pattern,
    sound: settings.sound,
    bpm: settings.bpm,
    swing: settings.swing,
    volume: settings.volume,
    mutes: new Set(settings.mutes),
  };
  const engine = new AudioEngine(state);
  let loopId = settings.loopId;
  let selTrack: TrackId = 'bass';
  let lastSynth: SynthTrackId = 'bass';
  let selStep = 0;
  let page = 0;
  let octave = 3;
  let rec = false;
  let tab: Tab = 'seq';
  let playhead = -1;
  let pendingLoop: ReturnType<typeof buildLoop> | null = null;
  const lastNote: Record<SynthTrackId, number> = { ...DEFAULT_NOTE };

  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  const persist = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const s: Settings = {
        loopId,
        bpm: state.bpm,
        swing: state.swing,
        volume: state.volume,
        pattern: state.pattern,
        sound: state.sound,
        mutes: [...state.mutes],
      };
      save(s);
    }, 300);
  };

  const narrow = window.matchMedia('(max-width: 640px)');
  const pageSize = () => (narrow.matches ? 8 : 16);
  const pageCount = () => Math.ceil(state.pattern.length / pageSize());

  // ---------- top bar ----------
  const playBtn = button(t.play, { class: 'play', 'data-testid': 'play' });
  const recBtn = button(t.rec, { class: 'rec', 'data-testid': 'rec', 'aria-pressed': 'false' });
  const bpmVal = h('input', {
    type: 'number',
    min: 40,
    max: 220,
    value: state.bpm,
    class: 'bpm',
    'aria-label': t.bpm,
    'data-testid': 'bpm',
    inputmode: 'numeric',
  });
  const bpmDown = button('−', { class: 'mini', 'aria-label': 'BPM −1' });
  const bpmUp = button('+', { class: 'mini', 'aria-label': 'BPM +1' });
  const tapBtn = button('Tap', { class: 'mini', 'data-testid': 'tap' });
  const swingIn = h('input', {
    type: 'range',
    min: 50,
    max: 75,
    step: 1,
    value: state.swing,
    'aria-label': t.swing,
    'data-testid': 'swing',
  });
  const swingVal = h('span', { class: 'val' }, `${state.swing}%`);
  const loopSel = select(
    LOOPS.map((l) => ({ value: l.id, label: `${l.name} · ${l.bpm}`, group: l.genre })).sort(
      (a, b) => GENRES.indexOf(a.group) - GENRES.indexOf(b.group),
    ),
    loopId,
    { 'data-testid': 'loop', 'aria-label': t.loop },
  );
  const volIn = h('input', {
    type: 'range',
    min: 0,
    max: 1,
    step: 0.01,
    value: state.volume,
    'aria-label': t.volume,
    'data-testid': 'volume',
  });
  const queuedNote = h(
    'span',
    { class: 'queued', 'data-testid': 'queued', hidden: true },
    t.queued,
  );
  const topbar = h(
    'header',
    { class: 'topbar' },
    h('span', { class: 'brand' }, 'GROOVEBOX'),
    playBtn,
    recBtn,
    h(
      'div',
      { class: 'group' },
      h('span', { class: 'lbl' }, t.bpm),
      bpmDown,
      bpmVal,
      bpmUp,
      tapBtn,
    ),
    h('label', { class: 'group' }, h('span', { class: 'lbl' }, t.swing), swingIn, swingVal),
    h('label', { class: 'group' }, h('span', { class: 'lbl' }, t.loop), loopSel),
    queuedNote,
    h('label', { class: 'group' }, h('span', { class: 'lbl' }, t.volume), volIn),
  );

  // ---------- tabs ----------
  const tabs = h('nav', { class: 'tabs', role: 'tablist' });
  const tabBtns = new Map<Tab, HTMLButtonElement>();
  for (const id of ['seq', 'sound', 'keys', 'fx'] as Tab[]) {
    const b = button(t[id], { role: 'tab', 'data-testid': `tab-${id}` });
    b.addEventListener('click', () => setTab(id));
    tabBtns.set(id, b);
    tabs.append(b);
  }

  // ---------- sequencer ----------
  const grid = h('div', { class: 'grid', 'data-testid': 'grid' });
  const pager = h('div', { class: 'pager' });
  const lenBtn = button('', { class: 'mini', 'data-testid': 'length' });
  const clearBtn = button(t.clear, { class: 'mini', 'data-testid': 'clear' });
  const targetLbl = h('span', { class: 'target' });
  const seqTools = h('div', { class: 'seq-tools' }, lenBtn, pager, clearBtn, targetLbl);
  const inspector = h('div', { class: 'inspector', 'data-testid': 'inspector' });
  const seqPanel = h('section', { class: 'panel panel-seq' }, seqTools, grid, inspector);

  const rows = new Map<
    TrackId,
    { row: HTMLDivElement; mute: HTMLButtonElement; cells: HTMLButtonElement[] }
  >();
  function buildGrid(): void {
    grid.replaceChildren();
    rows.clear();
    const n = pageSize();
    grid.style.setProperty('--steps', String(n));
    for (const id of TRACK_IDS) {
      const name = button(t.short[id], {
        class: 'lane-name',
        title: t.tracks[id],
        'data-testid': `lane-${id}`,
      });
      name.addEventListener('click', () => selectTrack(id));
      const mute = button(t.mute, {
        class: 'mute',
        'data-testid': `mute-${id}`,
        'aria-label': `Mute ${t.tracks[id]}`,
      });
      mute.addEventListener('click', () => {
        if (state.mutes.has(id)) state.mutes.delete(id);
        else state.mutes.add(id);
        renderGrid();
        persist();
      });
      const cells: HTMLButtonElement[] = [];
      const row = h(
        'div',
        { class: `lane ${isDrum(id) ? 'drum' : 'synth'}`, 'data-track': id },
        name,
        mute,
      );
      for (let i = 0; i < n; i++) {
        const cell = h('button', {
          type: 'button',
          class: 'cell',
          'data-i': i,
          'aria-label': `${t.tracks[id]} step`,
        });
        bindCell(cell, id, i);
        cells.push(cell);
        row.append(cell);
      }
      rows.set(id, { row, mute, cells });
      grid.append(row);
    }
  }

  function bindCell(cell: HTMLButtonElement, id: TrackId, i: number): void {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let long = false;
    cell.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      long = false;
      timer = setTimeout(() => {
        long = true;
        selectStep(id, page * pageSize() + i);
      }, 400);
    });
    const cancel = () => clearTimeout(timer);
    cell.addEventListener('pointerleave', cancel);
    cell.addEventListener('pointercancel', cancel);
    cell.addEventListener('pointerup', () => {
      clearTimeout(timer);
      if (long) return;
      const idx = page * pageSize() + i;
      toggleStep(id, idx);
    });
    cell.addEventListener('contextmenu', (e) => e.preventDefault());
    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        toggleStep(id, page * pageSize() + i);
      }
    });
  }

  function toggleStep(id: TrackId, idx: number): void {
    const s = state.pattern.tracks[id][idx];
    if (!s) return;
    s.on = !s.on;
    if (s.on && !isDrum(id)) s.note = lastNote[id];
    if (s.on && !isDrum(id)) previewNote(id, s.note);
    if (s.on && isDrum(id)) engine.hitDrum(id, s.accent);
    selectStep(id, idx);
    persist();
  }

  function previewNote(id: SynthTrackId, note: number): void {
    if (engine.running) return;
    engine.noteOn('preview', id, note);
    setTimeout(() => engine.noteOff('preview', id), 160);
  }

  function selectTrack(id: TrackId): void {
    selTrack = id;
    if (!isDrum(id)) lastSynth = id;
    renderGrid();
    renderInspector();
    renderSound();
  }

  function selectStep(id: TrackId, idx: number): void {
    selStep = idx;
    selectTrack(id);
  }

  function renderGrid(): void {
    const n = pageSize();
    const off = page * n;
    for (const [id, { row, mute, cells }] of rows) {
      row.classList.toggle('selected', id === selTrack);
      row.classList.toggle('muted', state.mutes.has(id));
      mute.setAttribute('aria-pressed', String(state.mutes.has(id)));
      const steps = state.pattern.tracks[id];
      cells.forEach((cell, i) => {
        const idx = off + i;
        const s = steps[idx]!;
        const beyond = idx >= state.pattern.length;
        cell.disabled = beyond;
        cell.classList.toggle('on', s.on && !beyond);
        cell.classList.toggle('accent', s.on && s.accent);
        cell.classList.toggle('beat', idx % 4 === 0);
        cell.classList.toggle('sel', id === selTrack && idx === selStep);
        cell.classList.toggle('play', idx === playhead);
        cell.dataset.extra =
          s.on && !beyond
            ? [
                s.ratchet > 1 ? `×${s.ratchet}` : '',
                s.prob < 1 ? `${Math.round(s.prob * 100)}%` : '',
                s.slide ? '~' : '',
              ].join('')
            : '';
        cell.textContent = s.on && !beyond && !isDrum(id) ? noteName(s.note) : '';
      });
    }
    lenBtn.textContent = `${t.length} ${state.pattern.length}`;
    pager.replaceChildren();
    if (pageCount() > 1) {
      for (let p = 0; p < pageCount(); p++) {
        const b = button(String(p + 1), {
          class: `mini page${p === page ? ' cur' : ''}`,
          'data-testid': `page-${p}`,
        });
        if (playhead >= 0 && Math.floor(playhead / n) === p) b.classList.add('live');
        b.addEventListener('click', () => {
          page = p;
          renderGrid();
        });
        pager.append(b);
      }
    }
    targetLbl.textContent = `${t.keys} → ${t.tracks[lastSynth]}`;
  }

  function renderInspector(): void {
    const id = selTrack;
    const s: Step = state.pattern.tracks[id][selStep] ?? emptyStep();
    const update = () => {
      persist();
      renderGrid();
      renderInspector();
    };
    const parts: (Node | string)[] = [
      h('span', { class: 'lbl' }, `${t.step} ${selStep + 1} · ${t.short[id]}`),
    ];
    if (!isDrum(id)) {
      const down = button('−', {
        class: 'mini',
        'aria-label': 'note down',
        'data-testid': 'note-down',
      });
      const up = button('+', { class: 'mini', 'aria-label': 'note up', 'data-testid': 'note-up' });
      const octDown = button('−12', { class: 'mini' });
      const octUp = button('+12', { class: 'mini' });
      const shift = (d: number) => {
        s.note = clamp(s.note + d, 12, 108);
        s.on = true;
        lastNote[id] = s.note;
        previewNote(id, s.note);
        update();
      };
      down.addEventListener('click', () => shift(-1));
      up.addEventListener('click', () => shift(1));
      octDown.addEventListener('click', () => shift(-12));
      octUp.addEventListener('click', () => shift(12));
      parts.push(
        h(
          'span',
          { class: 'group' },
          octDown,
          down,
          h('b', { class: 'note', 'data-testid': 'note' }, noteName(s.note)),
          up,
          octUp,
        ),
      );
    }
    const toggle = (label: string, key: 'accent' | 'slide') => {
      const b = button(label, {
        class: 'mini toggle',
        'aria-pressed': String(s[key]),
        'data-testid': `step-${key}`,
      });
      b.addEventListener('click', () => {
        s[key] = !s[key];
        update();
      });
      return b;
    };
    parts.push(toggle(t.accent, 'accent'));
    if (!isDrum(id)) parts.push(toggle(t.slide, 'slide'));
    const prob = select(
      PROBS.map((p) => ({ value: p, label: `${p * 100}%` })),
      PROBS.includes(s.prob as (typeof PROBS)[number]) ? s.prob : 1,
      { 'aria-label': t.prob, 'data-testid': 'step-prob' },
    );
    prob.addEventListener('change', () => {
      s.prob = Number(prob.value);
      update();
    });
    const ratchet = select(
      [1, 2, 3, 4].map((r) => ({ value: r, label: `×${r}` })),
      s.ratchet,
      { 'aria-label': t.ratchet, 'data-testid': 'step-ratchet' },
    );
    ratchet.addEventListener('change', () => {
      s.ratchet = Number(ratchet.value) as Ratchet;
      update();
    });
    parts.push(
      h('label', { class: 'group' }, h('span', { class: 'lbl' }, t.prob), prob),
      h('label', { class: 'group' }, h('span', { class: 'lbl' }, t.ratchet), ratchet),
    );
    if (!isDrum(id)) {
      const lock = h('input', {
        type: 'range',
        min: 0,
        max: 1,
        step: 0.01,
        value: s.cutoff ?? state.sound.synths[id].cutoff,
        'aria-label': t.cutoffLock,
        class: s.cutoff === undefined ? 'unlocked' : '',
      });
      lock.addEventListener('input', () => {
        s.cutoff = Number(lock.value);
        lock.classList.remove('unlocked');
        persist();
      });
      const clr = button('×', { class: 'mini', 'aria-label': 'clear lock' });
      clr.addEventListener('click', () => {
        delete s.cutoff;
        update();
      });
      parts.push(
        h('label', { class: 'group' }, h('span', { class: 'lbl' }, t.cutoffLock), lock, clr),
      );
    }
    inspector.replaceChildren(...parts);
  }

  lenBtn.addEventListener('click', () => {
    state.pattern.length = state.pattern.length === 16 ? 32 : 16;
    page = Math.min(page, pageCount() - 1);
    persist();
    renderGrid();
  });
  clearBtn.addEventListener('click', () => {
    state.pattern.tracks[selTrack] = state.pattern.tracks[selTrack].map((s) => ({
      ...emptyStep(s.note),
    }));
    persist();
    renderGrid();
    renderInspector();
  });

  // ---------- sound ----------
  const soundPanel = h('section', { class: 'panel panel-sound', 'data-testid': 'sound' });
  function renderSound(): void {
    const id = selTrack;
    const title = h('h2', {}, t.tracks[id]);
    const ctrls: Node[] = [];
    if (isDrum(id)) {
      const p = state.sound.drums[id];
      for (const d of DRUM_PARAMS)
        ctrls.push(
          slider(d.label, p[d.key], (v) => {
            p[d.key] = v;
            engine.applyMix();
            persist();
          }),
        );
      const hit = button('▶', { class: 'mini', 'aria-label': 'audition' });
      hit.addEventListener('click', () => engine.hitDrum(id));
      title.append(' ', hit);
    } else {
      const p = state.sound.synths[id];
      const engines = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': t.engine });
      for (const e of ENGINES) {
        const b = button(e.label, {
          role: 'radio',
          'aria-checked': String(p.engine === e.id),
          'data-testid': `engine-${e.id}`,
        });
        b.addEventListener('click', () => {
          engine.allNotesOff();
          p.engine = e.id as EngineId;
          persist();
          renderSound();
        });
        engines.append(b);
      }
      ctrls.push(engines);
      for (const d of SYNTH_PARAMS)
        ctrls.push(
          slider(
            d.key === 'tone' ? toneLabel(p.engine) : d.label,
            p[d.key],
            (v) => {
              p[d.key] = v;
              engine.applyMix();
              persist();
            },
            `param-${d.key}`,
          ),
        );
      const pick = (
        label: string,
        key: 'algo' | 'ratio' | 'chord',
        opts: { value: number; label: string }[],
      ) => {
        const sel = select(opts, p[key], { 'aria-label': label, 'data-testid': `param-${key}` });
        sel.addEventListener('change', () => {
          (p as SynthParams)[key] = Number(sel.value);
          persist();
        });
        return h('label', { class: 'knob' }, h('span', {}, label), sel);
      };
      if (p.engine === 'fm') {
        ctrls.push(
          pick(
            t.algo,
            'algo',
            FM_ALGOS.map((a, i) => ({ value: i, label: `${i + 1}. ${a.name}` })),
          ),
        );
        ctrls.push(
          pick(
            t.ratio,
            'ratio',
            FM_RATIOS.map((r, i) => ({ value: i, label: `×${r}` })),
          ),
        );
      }
      if (p.engine !== 'acid')
        ctrls.push(
          pick(
            t.chord,
            'chord',
            CHORDS.map((c, i) => ({ value: i, label: c.label })),
          ),
        );
    }
    soundPanel.replaceChildren(title, h('div', { class: 'knobs' }, ...ctrls));
  }
  const toneLabel = (e: EngineId) => (e === 'acid' ? 'Saw→Sq' : e === 'fm' ? 'FM index' : 'Detune');

  // ---------- keys ----------
  const drumPads = new HoldPads<DrumId>(
    DRUM_IDS.map((id, i) => ({ id, label: t.short[id], hint: 'zxcvbn'[i] })),
    'drum-pads',
    {
      gesture: () => void ensureAudio(),
      down: (id) => {
        engine.hitDrum(id);
        recordDrum(id);
      },
      up: () => {},
    },
  );
  const octLbl = h('span', { class: 'val', 'data-testid': 'octave' });
  const octDown = button('Oct −', { class: 'mini' });
  const octUp = button('Oct +', { class: 'mini' });
  octDown.addEventListener('click', () => setOctave(octave - 1));
  octUp.addEventListener('click', () => setOctave(octave + 1));
  const keyboard = new Keyboard({
    gesture: () => void ensureAudio(),
    press: (p, off) => noteOn(p, off),
    slide: (p, from, to) => {
      noteOff(p, from);
      noteOn(p, to);
    },
    release: (p, off) => noteOff(p, off),
  });
  const keysPanel = h(
    'section',
    { class: 'panel panel-keys' },
    drumPads.el,
    h('div', { class: 'key-tools' }, octDown, octLbl, octUp, targetLbl.cloneNode()),
    keyboard.el,
  );
  const keysTarget = keysPanel.querySelector('.key-tools .target') as HTMLElement;

  function setOctave(o: number): void {
    engine.allNotesOff();
    octave = clamp(o, 0, 6);
    octLbl.textContent = `C${octave}`;
    keyboard.labelOctave((i) => `C${octave + i / 12}`);
  }

  const midiOf = (offset: number) => (octave + 1) * 12 + offset;
  const held = new Map<string, number>();
  function noteOn(key: string, offset: number): void {
    const note = midiOf(offset);
    held.set(key, note);
    engine.noteOn(key, lastSynth, note);
    lastNote[lastSynth] = note;
    recordNote(note);
  }
  function noteOff(key: string, _offset?: number): void {
    held.delete(key);
    engine.noteOff(key, lastSynth);
  }

  function recordNote(note: number): void {
    if (!rec) return;
    const steps = state.pattern.tracks[lastSynth];
    const idx = engine.running ? engine.nearestStep() : selStep;
    if (idx === undefined) return;
    const s = steps[idx]!;
    s.on = true;
    s.note = note;
    if (!engine.running && selTrack === lastSynth) selStep = (selStep + 1) % state.pattern.length;
    persist();
    renderGrid();
    renderInspector();
  }

  function recordDrum(id: DrumId): void {
    if (!rec) return;
    const idx = engine.running ? engine.nearestStep() : selStep;
    if (idx === undefined) return;
    const s = state.pattern.tracks[id][idx]!;
    if (engine.running && s.on) return;
    s.on = true;
    if (!engine.running) {
      selTrack = id;
      selStep = (idx + 1) % state.pattern.length;
    }
    persist();
    renderGrid();
    renderInspector();
  }

  // ---------- fx ----------
  const fxPads = new HoldPads<FxId>(
    FX_DEFS.map((f) => ({ id: f.id, label: f.label, hint: f.key })),
    'fx-pads',
    {
      gesture: () => void ensureAudio(),
      down: (id) => engine.fxOn(id),
      up: (id) => engine.fxOff(id),
    },
  );
  const fxPanel = h(
    'section',
    { class: 'panel panel-fx' },
    h('p', { class: 'hint' }, t.holdFx),
    fxPads.el,
  );

  // ---------- overlay & layout ----------
  const overlay = h(
    'button',
    { class: 'overlay', type: 'button', 'data-testid': 'start-overlay' },
    h('span', { class: 'overlay-title' }, t.tapToStart),
    h('span', { class: 'overlay-hint' }, t.tapHint),
  );
  const version = h('div', { class: 'version', 'data-testid': 'version' }, `v${__APP_VERSION__}`);
  const deck = h('main', { class: 'deck' }, seqPanel, soundPanel, keysPanel, fxPanel);
  const app = h('div', { class: 'app' }, topbar, tabs, deck, version, overlay);
  root.replaceChildren(app);

  function setTab(id: Tab): void {
    tab = id;
    app.dataset.tab = id;
    for (const [k, b] of tabBtns) b.setAttribute('aria-selected', String(k === tab));
  }

  // ---------- audio lifecycle ----------
  const markAudio = () => {
    document.body.dataset.audio = engine.ctx?.state ?? 'none';
  };
  function ensureAudio(): Promise<void> {
    const p = engine.unlock().then(markAudio, markAudio);
    if (engine.ctx && !engine.ctx.onstatechange) engine.ctx.onstatechange = markAudio;
    return p;
  }
  overlay.addEventListener('click', () => {
    void ensureAudio();
    overlay.hidden = true;
    initMidi();
  });
  document.addEventListener(
    'pointerdown',
    () => {
      if (engine.ctx && engine.ctx.state !== 'running') void ensureAudio();
    },
    true,
  );

  engine.onStep = (step) => {
    playhead = step;
    renderPlayhead();
  };
  engine.onPatternSwap = () => {
    if (pendingLoop) {
      state.sound = pendingLoop.sound;
      pendingLoop = null;
      engine.applyMix();
      renderSound();
      renderInspector();
    }
    queuedNote.hidden = true;
    persist();
  };

  let lastPage = -1;
  function renderPlayhead(): void {
    const n = pageSize();
    const pg = Math.floor(playhead / n);
    if (pg !== lastPage) {
      lastPage = pg;
      renderGrid();
      return;
    }
    for (const { cells } of rows.values())
      cells.forEach((c, i) => c.classList.toggle('play', page * n + i === playhead));
    for (const id of DRUM_IDS) {
      const s = state.pattern.tracks[id][playhead];
      if (s?.on && !state.mutes.has(id)) drumPads.flash(id);
    }
  }

  function setPlaying(on: boolean): void {
    if (on) {
      void ensureAudio();
      engine.start();
    } else {
      engine.stop();
      playhead = -1;
      queuedNote.hidden = true;
      if (pendingLoop) {
        state.sound = pendingLoop.sound;
        pendingLoop = null;
        engine.applyMix();
        renderSound();
      }
      fxPads.releaseAll();
      renderGrid();
    }
    playBtn.textContent = on ? t.stop : t.play;
    playBtn.classList.toggle('on', on);
    document.body.dataset.playing = String(on);
  }
  playBtn.addEventListener('click', () => setPlaying(!engine.running));
  recBtn.addEventListener('click', () => {
    rec = !rec;
    recBtn.setAttribute('aria-pressed', String(rec));
  });

  // ---------- transport controls ----------
  const setBpm = (v: number) => {
    const bpm = Math.round(clamp(v || 120, 40, 220));
    engine.setTempo(bpm);
    bpmVal.value = String(bpm);
    persist();
  };
  bpmVal.addEventListener('change', () => setBpm(Number(bpmVal.value)));
  bpmDown.addEventListener('click', () => setBpm(state.bpm - 1));
  bpmUp.addEventListener('click', () => setBpm(state.bpm + 1));
  const taps: number[] = [];
  tapBtn.addEventListener('click', () => {
    const now = performance.now();
    if (taps.length && now - taps[taps.length - 1]! > 2000) taps.length = 0;
    taps.push(now);
    if (taps.length > 5) taps.shift();
    if (taps.length >= 3) {
      const avg = (taps[taps.length - 1]! - taps[0]!) / (taps.length - 1);
      setBpm(60000 / avg);
    }
  });
  swingIn.addEventListener('input', () => {
    engine.setSwing(Number(swingIn.value));
    swingVal.textContent = `${state.swing}%`;
    persist();
  });
  volIn.addEventListener('input', () => {
    state.volume = Number(volIn.value);
    engine.applyMix();
    persist();
  });
  loopSel.addEventListener('change', () => {
    loopId = loopSel.value;
    const preset = getLoop(loopId);
    const built = buildLoop(preset);
    engine.setTempo(preset.bpm);
    engine.setSwing(preset.swing);
    bpmVal.value = String(preset.bpm);
    swingIn.value = String(preset.swing);
    swingVal.textContent = `${preset.swing}%`;
    page = 0;
    if (engine.queuePattern(built.pattern)) {
      pendingLoop = built;
      queuedNote.hidden = false;
    } else {
      state.sound = built.sound;
      engine.applyMix();
      renderGrid();
      renderSound();
      renderInspector();
    }
    persist();
    loopSel.blur();
  });

  // ---------- computer keyboard ----------
  const fxByKey = new Map<string, FxId>(FX_DEFS.map((f) => [f.key, f.id]));
  const isTyping = (e: KeyboardEvent) => {
    const el = e.target as HTMLElement | null;
    if (!el) return false;
    if (el.tagName === 'SELECT') return true;
    return el.tagName === 'INPUT' && (el as HTMLInputElement).type !== 'range';
  };
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e)) return;
    const k = e.key.toLowerCase();
    if (e.repeat) {
      if (k === ' ' || k in NOTE_KEYS || fxByKey.has(k)) e.preventDefault();
      return;
    }
    if (k === ' ') {
      e.preventDefault();
      void ensureAudio();
      overlay.hidden = true;
      setPlaying(!engine.running);
    } else if (k in NOTE_KEYS) {
      void ensureAudio();
      const off = NOTE_KEYS[k]!;
      keyboard.setDown(off, +1);
      noteOn(`k${k}`, off);
    } else if (k in DRUM_KEYS) {
      void ensureAudio();
      drumPads.press(DRUM_KEYS[k]!, +1);
    } else if (fxByKey.has(k)) {
      e.preventDefault();
      fxPads.press(fxByKey.get(k)!, +1);
    } else if (k === OCTAVE_DOWN) setOctave(octave - 1);
    else if (k === OCTAVE_UP) setOctave(octave + 1);
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (k in NOTE_KEYS && held.has(`k${k}`)) {
      keyboard.setDown(NOTE_KEYS[k]!, -1);
      noteOff(`k${k}`);
    } else if (k in DRUM_KEYS) drumPads.press(DRUM_KEYS[k]!, -1);
    else if (fxByKey.has(k)) fxPads.press(fxByKey.get(k)!, -1);
  });
  window.addEventListener('blur', () => {
    fxPads.releaseAll();
    engine.allNotesOff();
  });

  // ---------- Web MIDI (desktop bonus; not on iOS Safari) ----------
  function initMidi(): void {
    const nav = navigator as Navigator & { requestMIDIAccess?: () => Promise<MIDIAccess> };
    if (!nav.requestMIDIAccess) return;
    nav.requestMIDIAccess().then(
      (access) => {
        const bind = (input: MIDIInput) => {
          input.onmidimessage = (m) => {
            const [st = 0, note = 0, vel = 0] = m.data ?? [];
            const cmd = st & 0xf0;
            const base = (octave + 1) * 12;
            if (cmd === 0x90 && vel > 0) {
              engine.noteOn(`m${note}`, lastSynth, note);
              keyboard.setDown(note - base, +1);
              recordNote(note);
            } else if (cmd === 0x80 || (cmd === 0x90 && vel === 0)) {
              engine.noteOff(`m${note}`, lastSynth);
              keyboard.setDown(note - base, -1);
            }
          };
        };
        access.inputs.forEach(bind);
        access.onstatechange = () => access.inputs.forEach(bind);
      },
      () => {},
    );
  }

  narrow.addEventListener('change', () => {
    page = 0;
    buildGrid();
    renderGrid();
  });

  buildGrid();
  setTab(tab);
  setOctave(octave);
  selectTrack(selTrack);
  keysTarget.textContent = targetLbl.textContent;
  const syncTarget = new MutationObserver(() => (keysTarget.textContent = targetLbl.textContent));
  syncTarget.observe(targetLbl, { childList: true, characterData: true, subtree: true });
  markAudio();
  document.body.dataset.playing = 'false';
}
