import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pindrop } from '../src/index';

function mockVisibleLayout(el: HTMLElement, rect: { left: number; top: number; width: number; height: number }): void {
  el.getBoundingClientRect = () => ({
    ...rect,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    x: rect.left,
    y: rect.top,
    toJSON() { },
  });
  Object.defineProperty(el, 'offsetWidth', { configurable: true, value: rect.width });
  el.getClientRects = () => [{ ...el.getBoundingClientRect(), item: () => null, length: 1 } as unknown as DOMRectList];
}

async function flushTimers(): Promise<void> {
  await Promise.resolve();
  await vi.runAllTimersAsync();
}

describe('Pindrop visibility filtering', () => {
  let activeView = 'view-a';

  beforeEach(() => {
    vi.useFakeTimers();
    activeView = 'view-a';
    window.scrollTo = vi.fn();

    class ResizeObserverMock {
      observe(): void { }
      disconnect(): void { }
    }

    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('renders and navigates only visible comments across hidden anchors and scoped views', async () => {
    const screenAVisible = document.createElement('div');
    screenAVisible.id = 'screen-a-visible';
    screenAVisible.dataset.view = 'view-a';
    mockVisibleLayout(screenAVisible, { left: 20, top: 20, width: 120, height: 40 });

    const screenAHidden = document.createElement('div');
    screenAHidden.id = 'screen-a-hidden';
    screenAHidden.dataset.view = 'view-a';
    screenAHidden.style.display = 'none';
    mockVisibleLayout(screenAHidden, { left: 20, top: 80, width: 120, height: 40 });

    const screenBVisible = document.createElement('div');
    screenBVisible.id = 'screen-b-visible';
    screenBVisible.dataset.view = 'view-b';
    mockVisibleLayout(screenBVisible, { left: 20, top: 140, width: 120, height: 40 });

    document.body.append(screenAVisible, screenAHidden, screenBVisible);

    const pindrop = Pindrop.init({
      user: { name: 'Reviewer' },
      getScope: (element) => {
        const view = (element as HTMLElement).dataset.view;
        return view ? { view } : undefined;
      },
      isScopeActive: (scope) => scope.view === activeView,
    });

    await flushTimers();

    pindrop.addComment({ selector: '#screen-a-visible', text: 'Visible in A' });
    pindrop.addComment({ selector: '#screen-a-hidden', text: 'Hidden anchor in A' });
    activeView = 'view-b';
    pindrop.addComment({ selector: '#screen-b-visible', text: 'Visible in B' });
    activeView = 'view-a';
    pindrop.refresh();

    await flushTimers();

    const root = document.getElementById('pindrop-web-root')!;
    const shadowRoot = root.shadowRoot!;
    const pinContainer = document.getElementById('pindrop-web-pins')!;

    expect(pinContainer.querySelectorAll('[data-comment-id]')).toHaveLength(1);
    expect(shadowRoot.querySelectorAll('.pindrop-sidebar-row')).toHaveLength(1);
    expect(shadowRoot.textContent).toContain('Visible in A');
    expect(shadowRoot.textContent).not.toContain('Hidden anchor in A');
    expect(shadowRoot.textContent).not.toContain('Visible in B');

    activeView = 'view-b';
    pindrop.refresh();
    await flushTimers();

    expect(pinContainer.querySelectorAll('[data-comment-id]')).toHaveLength(1);
    expect(shadowRoot.querySelectorAll('.pindrop-sidebar-row')).toHaveLength(1);
    expect(shadowRoot.textContent).toContain('Visible in B');
    expect(shadowRoot.textContent).not.toContain('Visible in A');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: ']' }));
    await flushTimers();

    expect(shadowRoot.textContent).toContain('Visible in B');
    expect(shadowRoot.textContent).not.toContain('Hidden anchor in A');

    pindrop.destroy();
  });
});
