import type { PindropEventMap, PindropEvent } from './types';

type Listener<T> = (payload: T) => void;

export class EventEmitter {
  private listeners = new Map<string, Set<Listener<any>>>();

  on<E extends PindropEvent>(event: E, listener: Listener<PindropEventMap[E]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    return () => {
      this.listeners.get(event)?.delete(listener);
    };
  }

  off<E extends PindropEvent>(event: E, listener: Listener<PindropEventMap[E]>): void {
    this.listeners.get(event)?.delete(listener);
  }

  emit<E extends PindropEvent>(event: E, payload: PindropEventMap[E]): void {
    this.listeners.get(event)?.forEach((listener) => listener(payload));
  }

  removeAll(): void {
    this.listeners.clear();
  }
}