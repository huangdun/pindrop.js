import type { PindropOptions } from '../core/types';

declare global {
  interface Window {
    impress?: () => unknown;
  }
}

/**
 * Auto-detects impress.js and scopes pins to the active step.
 * impress.js moves steps via 3D CSS transforms — inactive steps are
 * off-screen but still in the DOM and not display:none.
 */
export function applyImpressAdapter(options: PindropOptions, refresh: () => void): (() => void) | undefined {
  if (typeof window.impress !== 'function') return undefined;

  const container = document.querySelector('#impress');
  if (!container) return undefined;

  if (!options.getScope) {
    options.getScope = (element: Element) => {
      const step = element.closest('.step');
      if (!step) return undefined;
      if (step.id) return { stepId: step.id };
      const steps = Array.from(document.querySelectorAll('#impress .step'));
      const idx = steps.indexOf(step);
      return idx !== -1 ? { stepIndex: idx } : undefined;
    };
  }

  if (!options.isScopeActive) {
    options.isScopeActive = (scope) => {
      // impress.js marks the active step with the 'present' class
      const active = document.querySelector('#impress .step.present');
      if (!active) return true; // not yet initialized — show all

      if (scope.stepId !== undefined) return active.id === scope.stepId;
      if (scope.stepIndex !== undefined) {
        const steps = Array.from(document.querySelectorAll('#impress .step'));
        return steps.indexOf(active) === scope.stepIndex;
      }
      return true;
    };
  }

  const onStepEnter = () => refresh();
  document.addEventListener('impress:stepenter', onStepEnter);
  return () => document.removeEventListener('impress:stepenter', onStepEnter);
}
