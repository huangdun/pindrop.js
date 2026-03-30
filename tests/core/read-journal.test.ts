import { describe, it, expect, beforeEach, vi } from 'vitest';
import { wrapWithReadJournal } from '../../src/core/read-journal';
import type { Comment } from '../../src/core/types';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
vi.stubGlobal('localStorage', localStorageMock);

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 'c1',
    anchor: { selector: '#x', offsetX: 0.5, offsetY: 0.5, viewportX: 0.5, viewportY: 0.5 },
    author: 'A',
    text: 'Hello',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    resolved: false,
    unread: false,
    replies: [],
    ...overrides,
  };
}

function makeAdapter(initial: Comment[] = []) {
  let store = initial.map(({ unread: _, ...c }) => c) as Comment[];
  return {
    load: async () => [...store],
    save: async (comments: Comment[]) => { store = [...comments]; },
    getStore: () => store,
  };
}

beforeEach(() => localStorageMock.clear());

describe('wrapWithReadJournal', () => {
  it('marks all comments unread on first load', async () => {
    const adapter = makeAdapter([makeComment({ id: 'c1' }), makeComment({ id: 'c2' })]);
    const wrapped = wrapWithReadJournal(adapter, 'test');
    const comments = await wrapped.load();
    expect(comments.every((c) => c.unread)).toBe(true);
  });

  it('marks comment as read after save with unread=false', async () => {
    const adapter = makeAdapter([makeComment({ id: 'c1' })]);
    const wrapped = wrapWithReadJournal(adapter, 'test');
    await wrapped.save([makeComment({ id: 'c1', unread: false })]);
    const comments = await wrapped.load();
    expect(comments[0].unread).toBe(false);
  });

  it('persists read state across load calls', async () => {
    const adapter = makeAdapter([makeComment({ id: 'c1' })]);
    const wrapped = wrapWithReadJournal(adapter, 'test');
    await wrapped.save([makeComment({ id: 'c1', unread: false })]);
    // Simulate a second load (e.g. after a poll)
    const comments = await wrapped.load();
    expect(comments[0].unread).toBe(false);
  });

  it('does not write unread field to the underlying adapter', async () => {
    const adapter = makeAdapter([]);
    const wrapped = wrapWithReadJournal(adapter, 'test');
    await wrapped.save([makeComment({ id: 'c1', unread: false })]);
    expect(adapter.getStore()[0]).not.toHaveProperty('unread');
  });

  it('uses separate journal keys per storageKey', async () => {
    const adapter1 = makeAdapter([makeComment({ id: 'c1' })]);
    const adapter2 = makeAdapter([makeComment({ id: 'c1' })]);
    const wrapped1 = wrapWithReadJournal(adapter1, 'site-a');
    const wrapped2 = wrapWithReadJournal(adapter2, 'site-b');

    await wrapped1.save([makeComment({ id: 'c1', unread: false })]);

    const a = await wrapped1.load();
    const b = await wrapped2.load();
    expect(a[0].unread).toBe(false);
    expect(b[0].unread).toBe(true); // site-b journal is independent
  });
});
