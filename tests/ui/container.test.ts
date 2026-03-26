import { describe, it, expect, afterEach } from 'vitest';
import { createContainer, destroyContainer } from '../../src/ui/container';

describe('createContainer', () => {
    let cleanup: (() => void) | null = null;

    afterEach(() => {
        cleanup?.();
        cleanup = null;
    });

    it('creates a root element appended to body', () => {
        const result = createContainer({ zIndex: 10000 });
        cleanup = () => destroyContainer(result);
        expect(document.body.contains(result.root)).toBe(true);
    });

    it('creates a shadow root', () => {
        const result = createContainer({ zIndex: 10000 });
        cleanup = () => destroyContainer(result);
        expect(result.shadowRoot).toBeDefined();
        expect(result.shadowRoot.mode).toBe('open');
    });

    it('creates a pin container outside shadow DOM', () => {
        const result = createContainer({ zIndex: 10000 });
        cleanup = () => destroyContainer(result);
        expect(result.pinContainer.style.pointerEvents).toBe('none');
    });

    it('destroyContainer removes root from DOM', () => {
        const result = createContainer({ zIndex: 10000 });
        destroyContainer(result);
        expect(document.body.contains(result.root)).toBe(false);
    });
});