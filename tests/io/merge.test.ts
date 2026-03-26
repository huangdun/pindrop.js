import { describe, it, expect } from 'vitest';
import { mergeComments } from '../../src/io/merge';
import type { Comment } from '../../src/core/types';

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 'c1',
    anchor: { selector: '#x', offsetX: 0.5, offsetY: 0.5, viewportX: 0.5, viewportY: 0.5 },
    author: 'A',
    text: 'Original',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    resolved: false,
    unread: false,
    replies: [],
    ...overrides,
  };
}

describe('mergeComments', () => {
  it('adds new comments from incoming', () => {
    const local = [makeComment({ id: 'c1' })];
    const incoming = [makeComment({ id: 'c2', text: 'New' })];
    const result = mergeComments(local, incoming);
    expect(result.comments).toHaveLength(2);
    expect(result.added).toBe(1);
  });

  it('last-writer-wins: newer updatedAt wins', () => {
    const local = [makeComment({ id: 'c1', text: 'Local', updatedAt: '2026-01-01T00:00:00Z' })];
    const incoming = [makeComment({ id: 'c1', text: 'Remote', updatedAt: '2026-01-02T00:00:00Z' })];
    const result = mergeComments(local, incoming);
    expect(result.comments[0].text).toBe('Remote');
    expect(result.merged).toBe(1);
  });

  it('local wins when local updatedAt is newer', () => {
    const local = [makeComment({ id: 'c1', text: 'Local', updatedAt: '2026-01-02T00:00:00Z' })];
    const incoming = [makeComment({ id: 'c1', text: 'Remote', updatedAt: '2026-01-01T00:00:00Z' })];
    const result = mergeComments(local, incoming);
    expect(result.comments[0].text).toBe('Local');
    expect(result.merged).toBe(1);
  });

  it('merges replies by union of ids', () => {
    const local = [makeComment({
      id: 'c1', replies: [
        { id: 'r1', author: 'A', text: 'Reply 1', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
      ]
    })];
    const incoming = [makeComment({
      id: 'c1', replies: [
        { id: 'r2', author: 'B', text: 'Reply 2', createdAt: '2026-01-01T01:00:00Z', updatedAt: '2026-01-01T01:00:00Z' },
      ]
    })];
    const result = mergeComments(local, incoming);
    expect(result.comments[0].replies).toHaveLength(2);
  });

  it('local wins on equal updatedAt timestamps', () => {
    const local = [makeComment({ id: 'c1', text: 'Local', updatedAt: '2026-01-01T00:00:00Z' })];
    const incoming = [makeComment({ id: 'c1', text: 'Remote', updatedAt: '2026-01-01T00:00:00Z' })];
    const result = mergeComments(local, incoming);
    expect(result.comments[0].text).toBe('Local');
  });

  it('deduplicates replies with same id, newer wins', () => {
    const local = [makeComment({
      id: 'c1', replies: [
        { id: 'r1', author: 'A', text: 'Old reply', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
      ]
    })];
    const incoming = [makeComment({
      id: 'c1', replies: [
        { id: 'r1', author: 'A', text: 'Updated reply', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z' },
      ]
    })];
    const result = mergeComments(local, incoming);
    expect(result.comments[0].replies).toHaveLength(1);
    expect(result.comments[0].replies[0].text).toBe('Updated reply');
  });
});