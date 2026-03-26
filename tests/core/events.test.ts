import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from '../../src/core/events';

describe('EventEmitter', () => {
  it('calls listener when event is emitted', () => {
    const emitter = new EventEmitter();
    const listener = vi.fn();
    emitter.on('comment:add', listener);
    const comment = { id: '1' } as any;
    emitter.emit('comment:add', comment);
    expect(listener).toHaveBeenCalledWith(comment);
  });

  it('returns unsubscribe function from on()', () => {
    const emitter = new EventEmitter();
    const listener = vi.fn();
    const unsub = emitter.on('comment:add', listener);
    unsub();
    emitter.emit('comment:add', { id: '1' } as any);
    expect(listener).not.toHaveBeenCalled();
  });

  it('supports multiple listeners for same event', () => {
    const emitter = new EventEmitter();
    const a = vi.fn();
    const b = vi.fn();
    emitter.on('comment:add', a);
    emitter.on('comment:add', b);
    emitter.emit('comment:add', { id: '1' } as any);
    expect(a).toHaveBeenCalled();
    expect(b).toHaveBeenCalled();
  });

  it('does not call listeners for different events', () => {
    const emitter = new EventEmitter();
    const listener = vi.fn();
    emitter.on('comment:add', listener);
    emitter.emit('comment:resolve', { id: '1' } as any);
    expect(listener).not.toHaveBeenCalled();
  });

  it('removeAll clears all listeners', () => {
    const emitter = new EventEmitter();
    const listener = vi.fn();
    emitter.on('comment:add', listener);
    emitter.removeAll();
    emitter.emit('comment:add', { id: '1' } as any);
    expect(listener).not.toHaveBeenCalled();
  });
});