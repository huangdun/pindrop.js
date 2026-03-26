import type { Anchor } from '../core/types';
import { generateSelector } from './selector';

export interface ResolvedPosition {
  x: number;
  y: number;
  anchored: boolean;
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
  const el = document.querySelector(anchor.selector);
  if (el) {
    const rect = el.getBoundingClientRect();
    return {
      x: rect.left + window.scrollX + rect.width * anchor.offsetX,
      y: rect.top + window.scrollY + rect.height * anchor.offsetY,
      anchored: true,
    };
  }

  // Viewport fallback
  return {
    x: window.innerWidth * anchor.viewportX,
    y: window.innerHeight * anchor.viewportY,
    anchored: false,
  };
}