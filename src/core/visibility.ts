import type { Comment, CommentScope, PindropOptions } from './types';

export interface CommentVisibility {
  scopeActive: boolean;
  anchorVisible: boolean;
  visible: boolean;
}

type ScopeHooks = Pick<PindropOptions, 'isScopeActive'>;

export function isElementVisible(element: Element): boolean {
  if (!(element instanceof HTMLElement)) {
    return true;
  }

  if (element.hidden) {
    return false;
  }

  const style = getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') {
    return false;
  }

  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return false;
  }

  return element.getClientRects().length > 0;
}

export function isScopeActive(scope: CommentScope | undefined, hooks: ScopeHooks): boolean {
  if (!scope) {
    return true;
  }

  if (!hooks.isScopeActive) {
    return true;
  }

  try {
    return hooks.isScopeActive(scope);
  } catch {
    return true;
  }
}

export function getCommentVisibility(comment: Comment, hooks: ScopeHooks): CommentVisibility {
  const scopeActive = isScopeActive(comment.scope, hooks);
  const allMatches = Array.from(document.querySelectorAll(comment.anchor.selector));
  // Element gone from DOM entirely → use viewport fallback, keep visible
  // Element exists but all hidden (e.g. inactive tab) → hide the pin
  const anchorVisible = allMatches.length === 0
    ? true
    : allMatches.some(el => isElementVisible(el as HTMLElement));

  return {
    scopeActive,
    anchorVisible,
    visible: scopeActive && anchorVisible,
  };
}

export function filterVisibleComments(comments: Comment[], hooks: ScopeHooks): Comment[] {
  return comments.filter((comment) => getCommentVisibility(comment, hooks).visible);
}
