import { h } from './dom';

export interface PadItem<T extends string> {
  id: T;
  label: string;
  hint?: string;
}

/**
 * A grid of hold-to-play pads. Multi-touch: each pointer holds its own pad
 * until it lifts (pointer capture), so several FX can be held at once.
 */
export class HoldPads<T extends string> {
  readonly el: HTMLDivElement;
  private pads = new Map<T, HTMLButtonElement>();
  private pointers = new Map<number, T>();
  private count = new Map<T, number>();

  constructor(
    items: PadItem<T>[],
    cls: string,
    private readonly handlers: { down(id: T): void; up(id: T): void; gesture?(): void },
  ) {
    this.el = h('div', { class: `pads ${cls}`, role: 'group' });
    for (const it of items) {
      const pad = h(
        'button',
        { class: 'pad', type: 'button', 'data-id': it.id, 'data-testid': `pad-${it.id}` },
        h('span', { class: 'pad-label' }, it.label),
        it.hint ? h('span', { class: 'pad-hint' }, it.hint) : null,
      );
      pad.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.handlers.gesture?.();
        try {
          pad.setPointerCapture(e.pointerId);
        } catch {
          /* synthetic pointer */
        }
        this.pointers.set(e.pointerId, it.id);
        this.press(it.id, +1);
      });
      const end = (e: PointerEvent) => {
        const id = this.pointers.get(e.pointerId);
        if (id === undefined) return;
        this.pointers.delete(e.pointerId);
        this.press(id, -1);
      };
      pad.addEventListener('pointerup', end);
      pad.addEventListener('pointercancel', end);
      pad.addEventListener('lostpointercapture', end);
      pad.addEventListener('contextmenu', (e) => e.preventDefault());
      this.pads.set(it.id, pad);
      this.el.append(pad);
    }
  }

  /** Press (+1) or release (−1) from any source: pointer, keyboard, MIDI. */
  press(id: T, delta: number): void {
    const before = this.count.get(id) ?? 0;
    const n = Math.max(0, before + delta);
    this.count.set(id, n);
    this.pads.get(id)?.classList.toggle('down', n > 0);
    if (before === 0 && n > 0) this.handlers.down(id);
    else if (before > 0 && n === 0) this.handlers.up(id);
  }

  /** Visual flash without holding (drum pads triggered by the sequencer, etc.). */
  flash(id: T): void {
    const pad = this.pads.get(id);
    if (!pad) return;
    pad.classList.remove('flash');
    void pad.offsetWidth;
    pad.classList.add('flash');
  }

  releaseAll(): void {
    for (const [id, n] of this.count) if (n > 0) this.press(id, -n);
    this.pointers.clear();
  }
}
