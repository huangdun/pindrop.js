/**
 * Attaches touch swipe-to-dismiss behaviour to a bottom sheet.
 * Dragging the handle downward translates the sheet; releasing past 30% height dismisses it.
 */
export function addSwipeToDismiss(
  handle: HTMLElement,
  sheet: HTMLElement,
  onDismiss: (isSwipe?: boolean) => void,
): void {
  let startY = 0;
  let currentDY = 0;
  let active = false;

  handle.addEventListener('touchstart', (e) => {
    startY = e.touches[0].clientY;
    currentDY = 0;
    active = true;
    sheet.style.transition = 'none';
  }, { passive: true });

  handle.addEventListener('touchmove', (e) => {
    if (!active) return;
    currentDY = Math.max(0, e.touches[0].clientY - startY);
    sheet.style.transform = `translateY(${currentDY}px)`;
  }, { passive: true });

  handle.addEventListener('touchend', () => {
    if (!active) return;
    active = false;
    if (currentDY > sheet.offsetHeight * 0.3) {
      sheet.style.transition = 'transform 0.2s ease-in';
      sheet.style.transform = `translateY(${sheet.offsetHeight}px)`;
      onDismiss(true);
    } else {
      sheet.style.transition = 'transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)';
      sheet.style.transform = '';
      setTimeout(() => { sheet.style.transition = ''; }, 250);
    }
  });
}
