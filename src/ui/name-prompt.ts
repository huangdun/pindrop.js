const svg16 = (inner: string) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const ICON_CLOSE = svg16(`<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`);

export class NamePrompt {
  constructor(private shadowContent: HTMLDivElement) { }

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
      const overlay = document.createElement('div');
      overlay.className = 'pindrop-name-overlay';
      overlay.style.pointerEvents = 'auto';

      const modal = document.createElement('div');
      modal.className = 'pindrop-name-modal';

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
        overlay.remove();
        resolve(null);
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
      input.autofocus = true;

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
        overlay.remove();
        resolve(name);
      };

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submit();
        if (e.key === 'Escape') {
          overlay.remove();
          resolve(null);
        }
        e.stopPropagation();
      });
      submitBtn.addEventListener('click', submit);

      body.append(desc, input, submitBtn);
      modal.append(header, body);
      overlay.appendChild(modal);
      this.shadowContent.appendChild(overlay);
      input.focus();
    });
  }
}