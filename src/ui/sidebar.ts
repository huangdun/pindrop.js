import type { Comment } from '../core/types';
import { ICON_AGENT } from '../styles/tokens';
import { addSwipeToDismiss } from './swipe';

export interface SidebarCallbacks {
  onCommentClick: (commentId: string) => void;
  onExport: () => void;
  onImport: () => void;
  onSwitchSide: () => void;
  onClose?: () => void;
}

type FilterMode = 'all' | 'open' | 'resolved';

const svg16 = (inner: string) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
// panel-left-open / panel-right-open
const ICON_TO_LEFT = svg16(`<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="m14 9-3 3 3 3"/>`);
const ICON_TO_RIGHT = svg16(`<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/><path d="m10 15 3-3-3-3"/>`);
const ICON_CLOSE = svg16(`<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`);

export class Sidebar {
  private el!: HTMLDivElement;
  private listEl!: HTMLDivElement;
  private visible = false;
  private filter: FilterMode = 'all';
  private comments: Comment[] = [];
  private readOnly = false;
  private activeCommentId: string | null = null;
  private filterButtons: HTMLButtonElement[] = [];
  private filterSlider!: HTMLDivElement;
  private position: 'left' | 'right' = 'right';
  private switchBtn!: HTMLButtonElement;
  private resizer!: HTMLDivElement;
  private currentWidth = 240;
  private isDragging = false;
  private storageKey: string | null = null;
  private shadowContent!: HTMLDivElement;
  private scrim: HTMLDivElement | null = null;
  private handle!: HTMLDivElement;

  constructor(private callbacks: SidebarCallbacks) { }

  setStorageKey(key: string): void {
    this.storageKey = key;
    try {
      const savedWidth = localStorage.getItem(`${key}-sidebar-width`);
      if (savedWidth) {
        const parsed = parseInt(savedWidth, 10);
        if (!isNaN(parsed) && parsed >= 240 && parsed <= 360) {
          this.currentWidth = parsed;
          if (this.el) {
            this.el.style.width = `${this.currentWidth}px`;
          }
        }
      }
    } catch {
      // Ignore
    }
  }

  render(shadowContent: HTMLDivElement, position: 'left' | 'right'): void {
    this.shadowContent = shadowContent;
    this.position = position;
    this.el = document.createElement('div');
    this.el.className = `pindrop-sidebar pindrop-sidebar-${position}`;
    this.el.style.pointerEvents = 'auto';
    this.el.style.width = `${this.currentWidth}px`;

    // Swipe handle (shown only in mobile sheet mode)
    this.handle = document.createElement('div');
    this.handle.className = 'pindrop-sheet-handle pindrop-sidebar-sheet-handle';
    const pill = document.createElement('div');
    pill.className = 'pindrop-sheet-handle-pill';
    this.handle.appendChild(pill);
    this.el.appendChild(this.handle);

    // Resizer
    this.resizer = document.createElement('div');
    this.resizer.className = 'pindrop-sidebar-resizer';
    this.resizer.addEventListener('mousedown', (e) => this.onDragStart(e));
    this.el.appendChild(this.resizer);

    // Header
    const header = document.createElement('div');
    header.className = 'pindrop-sidebar-header';

    const title = document.createElement('span');
    title.className = 'pindrop-sidebar-title';
    title.textContent = 'Review comments';

    this.switchBtn = document.createElement('button');
    this.switchBtn.className = 'pindrop-sidebar-icon-btn';
    this.switchBtn.innerHTML = position === 'right' ? ICON_TO_LEFT : ICON_TO_RIGHT;
    this.switchBtn.title = position === 'right' ? 'Move to left' : 'Move to right';
    this.switchBtn.addEventListener('click', () => this.callbacks.onSwitchSide());

    header.append(title, this.switchBtn);
    this.el.appendChild(header);

    // Filter bar
    const filterBar = document.createElement('div');
    filterBar.className = 'pindrop-sidebar-filter-bar';

    this.filterSlider = document.createElement('div');
    this.filterSlider.className = 'pindrop-sidebar-filter-slider';
    filterBar.appendChild(this.filterSlider);

    for (const f of ['all', 'open', 'resolved'] as FilterMode[]) {
      const btn = document.createElement('button');
      btn.textContent = f.charAt(0).toUpperCase() + f.slice(1);
      btn.className = `pindrop-sidebar-filter-btn${f === this.filter ? ' active' : ''}`;
      btn.addEventListener('click', () => this.setFilter(f));
      this.filterButtons.push(btn);
      filterBar.appendChild(btn);
    }
    this.el.appendChild(filterBar);

    // Comment list
    this.listEl = document.createElement('div');
    this.listEl.className = 'pindrop-sidebar-list';
    this.el.appendChild(this.listEl);

    shadowContent.appendChild(this.el);
    this.el.style.display = 'none';
    this.renderList();
  }

  show(mobile = false): void {
    this.visible = true;
    if (mobile) {
      this.el.classList.add('pindrop-sidebar-sheet');
      this.switchBtn.innerHTML = ICON_CLOSE;
      this.switchBtn.title = 'Close';
      this.switchBtn.style.display = '';
      this.switchBtn.onclick = () => { this.hide(); this.callbacks.onClose?.(); };
      addSwipeToDismiss(this.handle, this.el, (isSwipe) => { this.hide(isSwipe); this.callbacks.onClose?.(); });
      if (!this.scrim) {
        this.scrim = document.createElement('div');
        this.scrim.className = 'pindrop-sheet-scrim';
        this.scrim.style.touchAction = 'none';
        this.scrim.addEventListener('click', () => {
          this.hide();
          this.callbacks.onClose?.();
        });
        this.shadowContent.insertBefore(this.scrim, this.el);
      }
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    }
    this.el.style.display = '';
  }

  hide(isSwipe = false): void {
    this.visible = false;
    if (this.el.classList.contains('pindrop-sidebar-sheet')) {
      if (!isSwipe) {
        this.el.classList.remove('pindrop-sidebar-sheet');
      }
      this.switchBtn.innerHTML = this.position === 'right' ? ICON_TO_LEFT : ICON_TO_RIGHT;
      this.switchBtn.title = this.position === 'right' ? 'Move to left' : 'Move to right';
      this.switchBtn.onclick = null;
      if (this.scrim) {
        this.scrim.classList.add('pindrop-sheet-closing');
      }
      
      const finishHide = () => {
        this.el.classList.remove('pindrop-sidebar-sheet');
        this.scrim?.remove();
        this.scrim = null;
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        this.el.style.display = 'none';
      };

      if (isSwipe) {
        setTimeout(finishHide, 200);
      } else {
        finishHide();
      }
      return;
    }
    this.el.style.display = 'none';
  }

  toggle(): void {
    this.visible ? this.hide() : this.show();
  }

  isVisible(): boolean {
    return this.visible;
  }

  update(comments: Comment[]): void {
    this.comments = comments;
    this.renderList();
  }

  setActiveComment(commentId: string | null): void {
    this.activeCommentId = commentId;
    // Update selected state on rows
    const rows = this.listEl.querySelectorAll('.pindrop-sidebar-row');
    rows.forEach((row) => {
      const el = row as HTMLDivElement;
      el.querySelector('.pindrop-sidebar-row-content')?.classList.toggle(
        'selected',
        el.dataset.sidebarCommentId === commentId
      );
    });
  }

  setPosition(position: 'left' | 'right', locked = false): void {
    this.position = position;
    this.el.className = this.el.className.replace(/pindrop-sidebar-(left|right)/, `pindrop-sidebar-${position}`);
    this.switchBtn.innerHTML = position === 'right' ? ICON_TO_LEFT : ICON_TO_RIGHT;
    this.switchBtn.title = position === 'right' ? 'Move to left' : 'Move to right';
    this.switchBtn.disabled = locked;
    this.switchBtn.style.opacity = locked ? '0.3' : '';
    this.switchBtn.style.pointerEvents = locked ? 'none' : '';
  }

  setFilter(filter: FilterMode): void {
    this.filter = filter;
    const filters: FilterMode[] = ['all', 'open', 'resolved'];
    const idx = filters.indexOf(filter);
    this.filterButtons.forEach((btn, i) => {
      btn.classList.toggle('active', i === idx);
    });
    this.filterSlider.className = `pindrop-sidebar-filter-slider${idx > 0 ? ` pos-${idx}` : ''}`;
    this.renderList();
  }

  setReadOnly(readOnly: boolean): void {
    this.readOnly = readOnly;
  }

  private onDragStart(e: MouseEvent): void {
    if (this.readOnly) return;
    this.isDragging = true;
    const startX = e.clientX;
    const startWidth = this.el.offsetWidth;
    this.resizer.classList.add('dragging');

    // Prevent text selection during drag
    const originalUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';

    const onMove = (moveEvt: MouseEvent) => {
      if (!this.isDragging) return;
      const delta = moveEvt.clientX - startX;
      let newWidth = this.position === 'right' ? startWidth - delta : startWidth + delta;
      
      this.currentWidth = Math.max(240, Math.min(360, newWidth));
      this.el.style.width = `${this.currentWidth}px`;
    };

    const onUp = () => {
      this.isDragging = false;
      this.resizer.classList.remove('dragging');
      document.body.style.userSelect = originalUserSelect;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      
      if (this.storageKey) {
        try {
          localStorage.setItem(`${this.storageKey}-sidebar-width`, String(this.currentWidth));
        } catch {
          // Ignore
        }
      }
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    e.preventDefault();
  }

  private renderList(): void {
    this.listEl.innerHTML = '';

    let filtered = this.comments;
    if (this.filter === 'open') filtered = this.comments.filter((c) => !c.resolved);
    if (this.filter === 'resolved') filtered = this.comments.filter((c) => c.resolved);

    for (let i = 0; i < filtered.length; i++) {
      const comment = filtered[i];
      const globalIndex = this.comments.indexOf(comment) + 1;
      this.listEl.appendChild(this.createRow(comment, globalIndex));
    }

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'pindrop-sidebar-empty';

      const icon = document.createElement('div');
      icon.className = 'pindrop-sidebar-empty-icon';
      icon.innerHTML = `<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/></svg>`;

      const text = document.createElement('p');
      text.className = 'pindrop-sidebar-empty-text';
      if (this.filter === 'all') {
        text.textContent = 'Give feedback, ask a question, or just leave a note. Click anywhere to leave a comment.';
      } else {
        text.textContent = `No ${this.filter} comments`;
      }

      empty.append(icon, text);
      this.listEl.appendChild(empty);
    }
  }

  private createRow(comment: Comment, number: number): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'pindrop-sidebar-row';
    row.dataset.sidebarCommentId = comment.id;

    const content = document.createElement('div');
    content.className = 'pindrop-sidebar-row-content';
    if (this.activeCommentId === comment.id) content.classList.add('selected');
    if (comment.resolved) content.classList.add('resolved');
    if (!comment.unread) content.classList.add('read');

    // Pin number badge
    const badge = document.createElement('span');
    badge.className = 'pindrop-sidebar-num';
    badge.textContent = String(number);

    // Text content
    const body = document.createElement('div');
    body.className = 'pindrop-sidebar-body';

    const nameRow = document.createElement('div');
    nameRow.className = 'pindrop-sidebar-name-row';

    const author = document.createElement('strong');
    author.textContent = comment.author;

    const time = document.createElement('span');
    time.className = 'pindrop-time';
    time.textContent = this.formatTime(comment.createdAt);

    if (comment.meta?.source === 'agent') {
      const badge = document.createElement('span');
      badge.className = 'pindrop-agent-badge';
      badge.innerHTML = `${ICON_AGENT}Agent`;
      nameRow.append(author, badge, time);
    } else {
      nameRow.append(author, time);
    }

    const text = document.createElement('p');
    text.textContent = comment.text;

    body.append(nameRow, text);

    // Reply count — only show if > 0
    if (comment.replies.length > 0) {
      const meta = document.createElement('span');
      meta.className = 'pindrop-sidebar-meta';
      meta.textContent = `${comment.replies.length} ${comment.replies.length === 1 ? 'reply' : 'replies'}${comment.resolved ? ' · Resolved' : ''}`;
      body.appendChild(meta);
    } else if (comment.resolved) {
      const meta = document.createElement('span');
      meta.className = 'pindrop-sidebar-meta';
      meta.textContent = 'Resolved';
      body.appendChild(meta);
    }

    content.append(badge, body);
    row.appendChild(content);
    row.addEventListener('click', () => this.callbacks.onCommentClick(comment.id));
    return row;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private formatTime(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  }

  destroy(): void {
    this.el.remove();
  }
}
