import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Store } from '../../src/core/store';
import { EventEmitter } from '../../src/core/events';
import type { Comment, Anchor } from '../../src/core/types';

function makeAnchor(): Anchor {
  return { selector: '#test', offsetX: 0.5, offsetY: 0.5, viewportX: 0.5, viewportY: 0.5 };
}

function makeComment(overrides: Partial<Comment> = {}): Comment {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    anchor: makeAnchor(),
    author: 'Test',
    text: 'Hello',
    createdAt: now,
    updatedAt: now,
    resolved: false,
    unread: false,
    replies: [],
    ...overrides,
  };
}

describe('Store', () => {
  let store: Store;
  let events: EventEmitter;

  beforeEach(() => {
    events = new EventEmitter();
    store = new Store(events);
  });

  it('starts with empty comments', () => {
    expect(store.getComments()).toEqual([]);
  });

  it('adds a comment and emits event', () => {
    const listener = vi.fn();
    events.on('comment:add', listener);
    const comment = makeComment();
    store.addComment(comment);
    expect(store.getComments()).toHaveLength(1);
    expect(listener).toHaveBeenCalledWith(comment);
  });

  it('returns comments sorted by createdAt', () => {
    const older = makeComment({ createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' });
    const newer = makeComment({ createdAt: '2026-01-02T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z' });
    store.addComment(newer);
    store.addComment(older);
    const comments = store.getComments();
    expect(comments[0].id).toBe(older.id);
    expect(comments[1].id).toBe(newer.id);
  });

  it('resolves a comment and emits event', () => {
    const comment = makeComment();
    store.addComment(comment);
    const listener = vi.fn();
    events.on('comment:resolve', listener);
    store.resolveComment(comment.id, 'Reviewer');
    const resolved = store.getComment(comment.id)!;
    expect(resolved.resolved).toBe(true);
    expect(resolved.resolvedBy).toBe('Reviewer');
    expect(resolved.resolvedAt).toBeDefined();
    expect(listener).toHaveBeenCalled();
  });

  it('reopens a resolved comment and emits event', () => {
    const comment = makeComment({ resolved: true });
    store.addComment(comment);
    const listener = vi.fn();
    events.on('comment:reopen', listener);
    store.reopenComment(comment.id);
    expect(store.getComment(comment.id)!.resolved).toBe(false);
    expect(listener).toHaveBeenCalled();
  });

  it('adds a reply and emits event', () => {
    const comment = makeComment();
    store.addComment(comment);
    const listener = vi.fn();
    events.on('reply:add', listener);
    const reply = {
      id: crypto.randomUUID(),
      author: 'Replier',
      text: 'Hi',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    store.addReply(comment.id, reply);
    expect(store.getComment(comment.id)!.replies).toHaveLength(1);
    expect(listener).toHaveBeenCalledWith({ comment: expect.any(Object), reply });
  });

  it('replaceAll sets all comments at once', () => {
    const c1 = makeComment();
    const c2 = makeComment();
    store.replaceAll([c1, c2]);
    expect(store.getComments()).toHaveLength(2);
  });
});