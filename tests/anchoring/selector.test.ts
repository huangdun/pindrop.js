import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { generateSelector } from '../../src/anchoring/selector';

describe('generateSelector', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    container.remove();
  });

  it('prefers id selector', () => {
    container.innerHTML = '<div id="my-element">Hello</div>';
    const el = container.querySelector('#my-element') as HTMLElement;
    expect(generateSelector(el)).toBe('#my-element');
  });

  it('prefers data-testid attribute', () => {
    container.innerHTML = '<div data-testid="chart-widget">Hello</div>';
    const el = container.querySelector('[data-testid]') as HTMLElement;
    expect(generateSelector(el)).toBe('[data-testid="chart-widget"]');
  });

  it('falls back to structural path', () => {
    container.innerHTML = '<main><section><p>first</p><p>second</p></section></main>';
    const el = container.querySelectorAll('p')[1] as HTMLElement;
    const selector = generateSelector(el);
    expect(document.querySelector(selector)).toBe(el);
  });

  it('generated selector uniquely identifies the element', () => {
    container.innerHTML = '<ul><li>A</li><li>B</li><li>C</li></ul>';
    const el = container.querySelectorAll('li')[1] as HTMLElement;
    const selector = generateSelector(el);
    expect(document.querySelector(selector)).toBe(el);
  });

  it('returns body for document.body', () => {
    expect(generateSelector(document.body)).toBe('body');
  });
});