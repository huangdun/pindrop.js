import styles from '../styles/styles.css?inline';
import { COMMENT_CURSOR } from '../styles/tokens';

export interface ContainerElements {
  root: HTMLDivElement;
  shadowRoot: ShadowRoot;
  shadowContent: HTMLDivElement;
  pinContainer: HTMLDivElement;
  overlay: HTMLDivElement;
}

export function createContainer(options: { zIndex: number }): ContainerElements {
  const root = document.createElement('div');
  root.id = 'pindrop-web-root';
  root.style.cssText = `position:fixed;top:0;left:0;width:0;height:0;z-index:${options.zIndex + 1};`;

  // Pin container — on document.body (not inside root, since shadow DOM hides light DOM children)
  const pinContainer = document.createElement('div');
  pinContainer.id = 'pindrop-web-pins';
  pinContainer.style.cssText = `position:absolute;top:0;left:0;width:0;height:0;z-index:${options.zIndex};pointer-events:none;display:none;`;

  // Comment-mode overlay — hidden by default
  const overlay = document.createElement('div');
  overlay.style.cssText = `position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:${options.zIndex};cursor:${COMMENT_CURSOR};display:none;`;

  // Shadow DOM for isolated UI
  const shadowRoot = root.attachShadow({ mode: 'open' });

  // Inject styles
  const styleEl = document.createElement('style');
  styleEl.textContent = styles;
  shadowRoot.appendChild(styleEl);

  // Shadow content wrapper
  const shadowContent = document.createElement('div');
  shadowContent.className = 'pindrop-shadow-content';
  shadowContent.style.cssText = `position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:${options.zIndex + 1};`;
  shadowRoot.appendChild(shadowContent);

  // Append in order: overlay, pins (above overlay for interaction), then root (with shadow) on top
  document.body.appendChild(overlay);
  document.body.appendChild(pinContainer);
  document.body.appendChild(root);

  return { root, shadowRoot, shadowContent, pinContainer, overlay };
}

export function destroyContainer(elements: ContainerElements): void {
  elements.pinContainer.remove();
  elements.overlay.remove();
  elements.root.remove();
}