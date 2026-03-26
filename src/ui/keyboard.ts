import type { PindropMode } from '../core/types';

export interface KeyboardCallbacks {
  onSetMode: (mode: PindropMode) => void;
  onEscape: () => void;
  onNextPin: () => void;
  onPrevPin: () => void;
}

export class KeyboardHandler {
  private handler: ((e: KeyboardEvent) => void) | null = null;
  private readOnly = false;

  constructor(private callbacks: KeyboardCallbacks) { }

  attach(): void {
    this.handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (this.isInputElement(target)) return;

      switch (e.key) {
        case 'v':
        case 'V':
          e.preventDefault();
          this.callbacks.onSetMode('view');
          break;
        case 'c':
        case 'C':
          if (!this.readOnly) {
            e.preventDefault();
            this.callbacks.onSetMode('comment');
          }
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          this.callbacks.onSetMode('review');
          break;
        case 'Escape':
          this.callbacks.onEscape();
          break;
        case ']':
          this.callbacks.onNextPin();
          break;
        case '[':
          this.callbacks.onPrevPin();
          break;
      }
    };
    document.addEventListener('keydown', this.handler);
  }

  setReadOnly(readOnly: boolean): void {
    this.readOnly = readOnly;
  }

  detach(): void {
    if (this.handler) {
      document.removeEventListener('keydown', this.handler);
      this.handler = null;
    }
  }

  private isInputElement(el: HTMLElement): boolean {
    const tag = el.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
  }
}