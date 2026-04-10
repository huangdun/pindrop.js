import type { PindropOptions } from '../core/types';

interface RevealState {
  indexh: number;
  indexv: number;
}

interface RevealAPI {
  getState(): RevealState;
  on(event: string, callback: () => void): void;
  off(event: string, callback: () => void): void;
}

declare global {
  interface Window {
    Reveal?: RevealAPI;
  }
}

/**
 * Auto-detects reveal.js and wires up scope hooks so pins are scoped to the
 * correct slide without any manual configuration from the user.
 *
 * Returns a cleanup function to remove the slidechanged listener on destroy.
 */
interface AdapterCallbacks {
  refresh: () => void;
  hidePins: () => void;
}

export function applyRevealAdapter(options: PindropOptions, { refresh, hidePins }: AdapterCallbacks): (() => void) | undefined {
  const Reveal = window.Reveal;
  if (!Reveal) return undefined;

  if (!options.getScope) {
    options.getScope = (element: Element) => {
      const slide = element.closest('.slides > section');
      if (!slide) return undefined;
      const allSlides = Array.from(document.querySelectorAll('.slides > section'));
      const indexh = allSlides.indexOf(slide);
      if (indexh === -1) return undefined;

      // Handle vertical (nested) slides
      const parent = slide.parentElement;
      const isNested = parent?.closest('.slides > section') !== null;
      if (isNested) {
        const parentSlide = parent!.closest('.slides > section')!;
        const allParents = Array.from(document.querySelectorAll('.slides > section'));
        const parentIndex = allParents.indexOf(parentSlide);
        const siblings = Array.from(parent!.children).filter(c => c.tagName === 'SECTION');
        const indexv = siblings.indexOf(slide);
        return { slideIndex: parentIndex, slideIndexV: indexv };
      }

      return { slideIndex: indexh };
    };
  }

  if (!options.isScopeActive) {
    options.isScopeActive = (scope) => {
      const state = Reveal.getState();
      if (scope.slideIndex !== state.indexh) return false;
      if (scope.slideIndexV !== undefined && scope.slideIndexV !== state.indexv) return false;
      return true;
    };
  }

  const onSlideChanged = () => {
    // Hide pins immediately so they don't ride along with the outgoing slide
    // during the CSS transition.
    hidePins();

    const incoming = document.querySelector('.reveal .slides section.present');
    if (incoming) {
      const done = () => {
        incoming.removeEventListener('transitionend', done);
        refresh();
      };
      incoming.addEventListener('transitionend', done);
      // Fallback for transition:none or very short transitions
      setTimeout(() => {
        incoming.removeEventListener('transitionend', done);
        refresh();
      }, 600);
    } else {
      refresh();
    }
  };
  Reveal.on('slidechanged', onSlideChanged);

  return () => Reveal.off('slidechanged', onSlideChanged);
}
