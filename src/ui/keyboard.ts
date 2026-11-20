import { isBlack, VISIBLE_KEYS } from '../data/keymap';
import { h } from './dom';

export interface KeyboardHandlers {
  /** A pointer pressed key `offset` (semitones above the lowest visible C). */
  press(pointer: string, offset: number): void;
  /** A held pointer slid from one key to another (glissando). */
  slide(pointer: string, from: number, to: number): void;
  release(pointer: string, offset: number): void;
  /** Called on every pointerdown, before press (used to resume audio on iOS). */
  gesture?(): void;
}

/**
 * Multi-touch on-screen keyboard. Each pointerId is tracked separately, so
 * chords work, and sliding a finger across keys plays a glissando.
 */
export class Keyboard {
  readonly el: HTMLDivElement;
  private keys: HTMLDivElement[] = [];
  private pointers = new Map<number, number>();
  private downCount = new Array<number>(VISIBLE_KEYS).fill(0);

  constructor(private readonly handlers: KeyboardHandlers) {
    this.el = h('div', {
      class: 'keyboard',
      'data-testid': 'keyboard',
      role: 'group',
      'aria-label': 'keyboard',
    });
    this.build();
    this.bind();
  }

  private build(): void {
    const whites = [...Array(VISIBLE_KEYS).keys()].filter((i) => !isBlack(i)).length;
    const w = 100 / whites;
    let whiteIdx = 0;
    for (let i = 0; i < VISIBLE_KEYS; i++) {
      const black = isBlack(i);
      const key = h(
        'div',
        { class: `key ${black ? 'black' : 'white'}`, 'data-offset': i },
        h('span', { class: 'name' }),
      );
      if (black) {
        key.style.left = `${whiteIdx * w - w * 0.32}%`;
        key.style.width = `${w * 0.64}%`;
      } else {
        key.style.left = `${whiteIdx * w}%`;
        key.style.width = `${w}%`;
        whiteIdx++;
      }
      this.keys.push(key);
      this.el.append(key);
    }
  }

  private keyAt(x: number, y: number): number | undefined {
    const el = document.elementFromPoint(x, y);
    const key = el?.closest<HTMLElement>('.key');
    if (!key || !this.el.contains(key)) return undefined;
    return Number(key.dataset.offset);
  }

  private bind(): void {
    const el = this.el;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.handlers.gesture?.();
      // Don't let the touched element capture the pointer: we hit-test ourselves.
      if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
      const k = this.keyAt(e.clientX, e.clientY);
      if (k === undefined) return;
      this.pointers.set(e.pointerId, k);
      this.setDown(k, +1);
      this.handlers.press(`p${e.pointerId}`, k);
    });
    el.addEventListener('pointermove', (e) => {
      const prev = this.pointers.get(e.pointerId);
      if (prev === undefined) return;
      const k = this.keyAt(e.clientX, e.clientY);
      if (k === undefined || k === prev) return;
      this.pointers.set(e.pointerId, k);
      this.setDown(prev, -1);
      this.setDown(k, +1);
      this.handlers.slide(`p${e.pointerId}`, prev, k);
    });
    const end = (e: PointerEvent) => {
      const prev = this.pointers.get(e.pointerId);
      if (prev === undefined) return;
      this.pointers.delete(e.pointerId);
      this.setDown(prev, -1);
      this.handlers.release(`p${e.pointerId}`, prev);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('pointerleave', end);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Visual press state for any source (pointer, QWERTY, MIDI). */
  setDown(offset: number, delta: number): void {
    if (offset < 0 || offset >= VISIBLE_KEYS) return;
    const n = Math.max(0, (this.downCount[offset] ?? 0) + delta);
    this.downCount[offset] = n;
    this.keys[offset]?.classList.toggle('down', n > 0);
  }

  /** Show note names on the C keys (e.g. "C2"). */
  labelOctave(firstName: (offset: number) => string): void {
    this.keys.forEach((key, i) => {
      const name = key.querySelector('.name');
      if (name) name.textContent = i % 12 === 0 ? firstName(i) : '';
    });
  }
}
