let lockCount = 0;
let lockedScrollY = 0;
let previousBodyStyles: Partial<CSSStyleDeclaration> | null = null;
let previousHtmlOverflow = '';

export function lockPageScroll(): void {
  lockCount += 1;
  if (lockCount > 1) return;

  lockedScrollY = window.scrollY || window.pageYOffset || 0;
  previousBodyStyles = {
    position: document.body.style.position,
    top: document.body.style.top,
    left: document.body.style.left,
    right: document.body.style.right,
    width: document.body.style.width,
    overflow: document.body.style.overflow,
  };
  previousHtmlOverflow = document.documentElement.style.overflow;

  document.documentElement.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.top = `-${lockedScrollY}px`;
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.style.width = '100%';
  document.body.style.overflow = 'hidden';
}

export function unlockPageScroll(): void {
  if (lockCount === 0) return;
  lockCount -= 1;
  if (lockCount > 0) return;

  if (previousBodyStyles) {
    document.body.style.position = previousBodyStyles.position ?? '';
    document.body.style.top = previousBodyStyles.top ?? '';
    document.body.style.left = previousBodyStyles.left ?? '';
    document.body.style.right = previousBodyStyles.right ?? '';
    document.body.style.width = previousBodyStyles.width ?? '';
    document.body.style.overflow = previousBodyStyles.overflow ?? '';
  } else {
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
  }

  document.documentElement.style.overflow = previousHtmlOverflow;
  window.scrollTo(0, lockedScrollY);
}
