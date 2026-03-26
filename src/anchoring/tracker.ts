import type { Store } from '../core/store';
import type { EventEmitter } from '../core/events';
import type { PinRenderer } from '../ui/pins';
import { resolveAnchorPosition } from './position';

export class AnchorTracker {
  private resizeObserver: ResizeObserver | null = null;
  private rafId: number | null = null;
  private scrollHandler: (() => void) | null = null;
  private resizeHandler: (() => void) | null = null;
  private knownAnchored = new Set<string>();

  constructor(
    private store: Store,
    private events: EventEmitter,
    private pinRenderer: PinRenderer,
    private onUpdate?: () => void
  ) { }

  start(): void {
    this.resizeObserver = new ResizeObserver(() => this.scheduleUpdate());
    this.resizeObserver.observe(document.body);

    this.scrollHandler = () => this.scheduleUpdate();
    window.addEventListener('scroll', this.scrollHandler, { passive: true });

    this.resizeHandler = () => this.scheduleUpdate();
    window.addEventListener('resize', this.resizeHandler, { passive: true });

    this.checkAnchors();
  }

  private scheduleUpdate(): void {
    if (this.rafId !== null) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.pinRenderer.updatePositions();
      this.onUpdate?.();
      this.checkAnchors();
    });
  }

  private checkAnchors(): void {
    for (const comment of this.store.getComments()) {
      const pos = resolveAnchorPosition(comment.anchor);
      const wasAnchored = this.knownAnchored.has(comment.id);

      if (pos.anchored) {
        this.knownAnchored.add(comment.id);
      } else if (wasAnchored) {
        this.knownAnchored.delete(comment.id);
        this.events.emit('anchor:lost', comment);
      }
    }
  }

  stop(): void {
    this.resizeObserver?.disconnect();
    if (this.scrollHandler) {
      window.removeEventListener('scroll', this.scrollHandler);
    }
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
  }
}