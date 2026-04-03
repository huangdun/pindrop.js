import type { Anchor } from '../core/types';
import { generateSelector } from './selector';
import { isElementVisible } from '../core/visibility';

export interface ResolvedPosition {
  x: number;
  y: number;
  anchored: boolean;
  visible: boolean;
}

/**
 * Finds the best matching element for a selector.
 * When multiple elements match (e.g. identical structure across show/hide tabs),
 * prefers the one that is currently visible over the first DOM match.
 */
export function queryBestElement(selector: string): Element | null {
  try {
    const all = Array.from(document.querySelectorAll(selector));
    if (all.length === 0) return null;
    if (all.length === 1) return all[0];
    return all.find(el => isElementVisible(el as HTMLElement)) ?? null;
  } catch {
    return document.querySelector(selector);
  }
}

export function createAnchor(element: Element, pageX: number, pageY: number): Anchor {
  const rect = element.getBoundingClientRect();
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  const offsetX = (pageX - (rect.left + scrollX)) / rect.width;
  const offsetY = (pageY - (rect.top + scrollY)) / rect.height;

  return {
    selector: generateSelector(element),
    offsetX: Math.max(0, Math.min(1, offsetX)),
    offsetY: Math.max(0, Math.min(1, offsetY)),
    viewportX: (pageX - window.scrollX) / window.innerWidth,
    viewportY: (pageY - window.scrollY) / window.innerHeight,
  };
}

export function resolveAnchorPosition(anchor: Anchor): ResolvedPosition {
  const el = queryBestElement(anchor.selector);
  if (el) {
    const rect = el.getBoundingClientRect();
    return {
      x: rect.left + window.scrollX + rect.width * anchor.offsetX,
      y: rect.top + window.scrollY + rect.height * anchor.offsetY,
      anchored: true,
      visible: isElementVisible(el),
    };
  }

  // Viewport fallback
  return {
    x: window.innerWidth * anchor.viewportX,
    y: window.innerHeight * anchor.viewportY,
    anchored: false,
    visible: true,
  };
}
