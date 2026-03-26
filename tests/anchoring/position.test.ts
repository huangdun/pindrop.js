import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createAnchor, resolveAnchorPosition } from '../../src/anchoring/position';

describe('createAnchor', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'anchor-test';
    document.body.appendChild(container);
    // jsdom doesn't do layout — mock getBoundingClientRect
    container.getBoundingClientRect = () => ({
      left: 100, top: 200, width: 400, height: 300,
      right: 500, bottom: 500, x: 100, y: 200, toJSON() { },
    });
  });

  afterEach(() => {
    container.remove();
  });

  it('creates anchor with selector, offsets, and viewport fallback', () => {
    // Click at center of element: (300, 350) in page coords
    // Element at (100,200) size (400,300), scrollX=0, scrollY=0
    // offsetX = (300 - 100) / 400 = 0.5
    // offsetY = (350 - 200) / 300 = 0.5
    const anchor = createAnchor(container, 300, 350);
    expect(anchor.selector).toBe('#anchor-test');
    expect(anchor.offsetX).toBeCloseTo(0.5, 1);
    expect(anchor.offsetY).toBeCloseTo(0.5, 1);
    expect(anchor.viewportX).toBeGreaterThanOrEqual(0);
    expect(anchor.viewportY).toBeGreaterThanOrEqual(0);
  });
});

describe('resolveAnchorPosition', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'resolve-test';
    document.body.appendChild(container);
    container.getBoundingClientRect = () => ({
      left: 100, top: 200, width: 400, height: 300,
      right: 500, bottom: 500, x: 100, y: 200, toJSON() { },
    });
  });

  afterEach(() => {
    container.remove();
  });

  it('resolves position from selector + offset', () => {
    const anchor = { selector: '#resolve-test', offsetX: 0.5, offsetY: 0.5, viewportX: 0.5, viewportY: 0.5 };
    const pos = resolveAnchorPosition(anchor);
    // x = 100 + 0 (scrollX) + 400 * 0.5 = 300
    // y = 200 + 0 (scrollY) + 300 * 0.5 = 350
    expect(pos.x).toBeCloseTo(300, -1);
    expect(pos.y).toBeCloseTo(350, -1);
    expect(pos.anchored).toBe(true);
  });

  it('falls back to viewport position when selector not found', () => {
    const anchor = { selector: '#nonexistent', offsetX: 0.5, offsetY: 0.5, viewportX: 0.3, viewportY: 0.4 };
    const pos = resolveAnchorPosition(anchor);
    expect(pos.x).toBe(window.innerWidth * 0.3);
    expect(pos.y).toBe(window.innerHeight * 0.4);
    expect(pos.anchored).toBe(false);
  });
});