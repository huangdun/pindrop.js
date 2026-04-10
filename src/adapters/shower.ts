import type { PindropOptions } from '../core/types';

declare global {
  interface Window {
    shower?: EventTarget & { slides?: unknown[] };
  }
}

/**
 * Auto-detects Shower.js and scopes pins to the active slide.
 * Shower marks the current slide with an 'active' class; we use a
 * MutationObserver to detect navigation since Shower's event API varies
 * between major versions.
 */
interface AdapterCallbacks {
  refresh: () => void;
  hidePins: () => void;
}

export function applyShowerAdapter(options: PindropOptions, { refresh, hidePins }: AdapterCallbacks): (() => void) | undefined {
  if (!window.shower) return undefined;

  const container = document.querySelector('.shower');
  if (!container) return undefined;

  const getSlides = () => Array.from(document.querySelectorAll('.shower .slide'));

  if (!options.getScope) {
    options.getScope = (element: Element) => {
      const slide = element.closest('.shower .slide');
      if (!slide) return undefined;
      const idx = getSlides().indexOf(slide);
      return idx !== -1 ? { slideIndex: idx } : undefined;
    };
  }

  if (!options.isScopeActive) {
    options.isScopeActive = (scope) => {
      if (scope.slideIndex === undefined) return true;
      const slide = getSlides()[scope.slideIndex as number];
      if (!slide) return false;
      return slide.classList.contains('active');
    };
  }

  // Shower @3 fires 'slidechange' on window.shower; fall back to MutationObserver
  // for older versions that lack this event.
  const shower = window.shower;
  if (typeof shower.addEventListener === 'function') {
    const onSlideChange = () => { hidePins(); refresh(); };
    shower.addEventListener('slidechange', onSlideChange);
    return () => shower.removeEventListener('slidechange', onSlideChange);
  }

  const observer = new MutationObserver(() => { hidePins(); refresh(); });
  observer.observe(container, { subtree: true, attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}
