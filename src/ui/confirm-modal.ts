const svg16 = (inner: string) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const ICON_CLOSE = svg16(`<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`);

export interface ConfirmModalOptions {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
}

export class ConfirmModal {
  constructor(private shadowContent: HTMLDivElement) { }

  show(options: ConfirmModalOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'pindrop-name-overlay';
      overlay.style.pointerEvents = 'auto';

      const modal = document.createElement('div');
      modal.className = 'pindrop-name-modal';

      // Header with title and close button
      const header = document.createElement('div');
      header.className = 'pindrop-confirm-header';

      const title = document.createElement('h3');
      title.textContent = options.title;

      const closeBtn = document.createElement('button');
      closeBtn.className = 'pindrop-sidebar-icon-btn';
      closeBtn.innerHTML = ICON_CLOSE;
      closeBtn.title = 'Close';
      closeBtn.addEventListener('click', () => {
        overlay.remove();
        resolve(false);
      });

      header.append(title, closeBtn);

      const body = document.createElement('div');
      body.className = 'pindrop-confirm-body';

      const desc = document.createElement('p');
      desc.textContent = options.description;

      const confirmBtn = document.createElement('button');
      confirmBtn.className = options.destructive ? 'pindrop-name-submit pindrop-btn-destructive' : 'pindrop-name-submit';
      confirmBtn.textContent = options.confirmLabel;
      confirmBtn.addEventListener('click', () => {
        overlay.remove();
        resolve(true);
      });

      body.append(desc, confirmBtn);
      modal.append(header, body);

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.remove();
          resolve(false);
        }
      });

      overlay.appendChild(modal);
      this.shadowContent.appendChild(overlay);
      confirmBtn.focus();
    });
  }
}