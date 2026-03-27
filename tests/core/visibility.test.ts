import { afterEach, describe, expect, it } from 'vitest';
import { filterVisibleComments, getCommentVisibility } from '../../src/core/visibility';
import type { Comment } from '../../src/core/types';

function mockVisibleLayout(el: HTMLElement, rect = { left: 10, top: 20, width: 120, height: 40 }): void {
  el.getBoundingClientRect = () => ({
    ...rect,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    x: rect.left,
    y: rect.top,
    toJSON() { },
  });
  el.getClientRects = () => [{ ...el.getBoundingClientRect(), item: () => null, length: 1 } as unknown as DOMRectList];
}

function makeComment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 'comment-1',
    anchor: { selector: '#anchor', offsetX: 0.5, offsetY: 0.5, viewportX: 0.5, viewportY: 0.5 },
    author: 'Test',
    text: 'Hello',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    resolved: false,
    unread: false,
    replies: [],
    ...overrides,
  };
}

describe('comment visibility', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('treats comments on hidden anchors as not visible', () => {
    const anchor = document.createElement('div');
    anchor.id = 'anchor';
    anchor.style.display = 'none';
    mockVisibleLayout(anchor);
    document.body.appendChild(anchor);

    const visibility = getCommentVisibility(makeComment(), {});
    expect(visibility.anchorVisible).toBe(false);
    expect(visibility.visible).toBe(false);
  });

  it('keeps viewport-fallback comments visible when the anchor no longer resolves', () => {
    const visibility = getCommentVisibility(makeComment({ anchor: { selector: '#missing', offsetX: 0.5, offsetY: 0.5, viewportX: 0.5, viewportY: 0.5 } }), {});
    expect(visibility.anchorVisible).toBe(true);
    expect(visibility.visible).toBe(true);
  });

  it('filters scoped comments with optional scope hooks and preserves unscoped comments', () => {
    const anchor = document.createElement('div');
    anchor.id = 'anchor';
    mockVisibleLayout(anchor);
    document.body.appendChild(anchor);

    const comments = [
      makeComment({ id: 'legacy' }),
      makeComment({ id: 'state-a', scope: { state: 'a' } }),
      makeComment({ id: 'state-b', scope: { state: 'b' } }),
    ];

    const visible = filterVisibleComments(comments, {
      isScopeActive: (scope) => scope.state === 'a',
    });

    expect(visible.map((comment) => comment.id)).toEqual(['legacy', 'state-a']);
  });
});
