import { addSwipeToDismiss } from './swipe';

const svg16 = (inner: string) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const ICON_CLOSE = svg16(`<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`);

export class NamePrompt {
  constructor(private shadowContent: HTMLDivElement) { }

  private isMobile(): boolean {
    return window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 480;
  }

  async prompt(storageKey: string): Promise<string | null> {
    const key = `${storageKey}-user`;

    // Check localStorage first
    try {
      const stored = localStorage.getItem(key);
      if (stored) return stored;
    } catch {
      // localStorage unavailable (private browsing)
    }

    return this.showPrompt(key);
  }

  async edit(storageKey: string): Promise<string | null> {
    const key = `${storageKey}-user`;
    let currentName = '';
    try {
      currentName = localStorage.getItem(key) || '';
    } catch {
      // Ignore
    }
    return this.showPrompt(key, currentName);
  }

  private showPrompt(key: string, prefill = ''): Promise<string | null> {
    return new Promise<string | null>((resolve) => {
      const mobile = this.isMobile();

      const overlay = document.createElement('div');
      overlay.className = mobile ? 'pindrop-sheet-scrim' : 'pindrop-name-overlay';
      overlay.style.pointerEvents = 'auto';

      const modal = document.createElement('div');
      modal.className = mobile ? 'pindrop-name-modal pindrop-sheet' : 'pindrop-name-modal';

      let handle: HTMLDivElement | null = null;
      if (mobile) {
        modal.style.width = 'auto'; // override the 360px default from pindrop-name-modal
        overlay.style.touchAction = 'none';
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';

        handle = document.createElement('div');
        handle.className = 'pindrop-sheet-handle';
        const pill = document.createElement('div');
        pill.className = 'pindrop-sheet-handle-pill';
        handle.appendChild(pill);
        modal.appendChild(handle);
      }

      const closePrompt = (nameToResolve: string | null = null, isSwipe = false) => {
        const finish = () => {
          overlay.remove();
          if (mobile) {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
          }
          resolve(nameToResolve);
        };

        if (mobile) {
          if (!isSwipe) {
            modal.classList.add('pindrop-sheet-closing');
          }
          overlay.classList.add('pindrop-sheet-closing');
          setTimeout(finish, 220);
        } else {
          finish();
        }
      };

      if (mobile && handle) {
        addSwipeToDismiss(handle, modal, (isSwipe) => closePrompt(null, isSwipe));
      }

      // Allow clicking the overlay to close
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          closePrompt();
        }
      });

      // Titlebar
      const header = document.createElement('div');
      header.className = 'pindrop-confirm-header';
      const title = document.createElement('h3');
      title.textContent = 'What\'s your name?';

      const closeBtn = document.createElement('button');
      closeBtn.className = 'pindrop-sidebar-icon-btn';
      closeBtn.innerHTML = ICON_CLOSE;
      closeBtn.title = 'Close';
      closeBtn.addEventListener('click', () => {
        closePrompt(null);
      });

      header.append(title, closeBtn);

      // Body
      const body = document.createElement('div');
      body.className = 'pindrop-confirm-body';

      const desc = document.createElement('p');
      desc.textContent = 'This will be shown on your comments.';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'pindrop-name-input';
      input.placeholder = 'Enter your name';
      input.value = prefill;
      if (!mobile) {
        input.autofocus = true;
      }

      const submitBtn = document.createElement('button');
      submitBtn.className = 'pindrop-name-submit';
      submitBtn.textContent = 'Save';
      submitBtn.disabled = !prefill;

      input.addEventListener('input', () => {
        submitBtn.disabled = !input.value.trim();
      });

      const submit = () => {
        const name = input.value.trim();
        if (!name) return;
        
        try {
          localStorage.setItem(key, name);
        } catch {
          // Ignore storage errors
        }
        closePrompt(name);
      };

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submit();
        if (e.key === 'Escape') {
          closePrompt(null);
        }
        e.stopPropagation();
      });
      submitBtn.addEventListener('click', submit);

      body.append(desc, input, submitBtn);
      modal.append(header, body);
      overlay.appendChild(modal);
      this.shadowContent.appendChild(overlay);
      if (!mobile) {
        input.focus();
      }
    });
  }
}