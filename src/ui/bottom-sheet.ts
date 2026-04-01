import type { Comment } from '../core/types';
import { avatarColor, ICON_AGENT } from '../styles/tokens';
import type { PopoverCallbacks } from './popover';
import { addSwipeToDismiss } from './swipe';

// Lucide icon paths (24x24)
const svgBtn = (inner: string) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const ICON_RESOLVE = svgBtn(`<path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/><path d="m9 12 2 2 4-4"/>`);
const ICON_RESOLVED = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/><path d="m9 12 2 2 4-4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_CLOSE = svgBtn(`<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`);
const ICON_MORE = svgBtn(`<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>`);
const ICON_SEND = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>`;
const ICON_EDIT = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>`;
const ICON_TRASH = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`;

export class BottomSheet {
  private el: HTMLDivElement | null = null;
  private scrim: HTMLDivElement | null = null;
  private activeRowMenu: HTMLDivElement | null = null;
  private menu: HTMLDivElement | null = null;
  private currentCommentId: string | null = null;
  private readOnly = false;
  private currentUser: string | null = null;

  constructor(
    private shadowContent: HTMLDivElement,
    private callbacks: PopoverCallbacks
  ) { }

  setUser(name: string | null): void {
    this.currentUser = name;
  }

  setReadOnly(readOnly: boolean): void {
    this.readOnly = readOnly;
  }

  show(comment: Comment, _position: { x: number; y: number }): void {
    this.hide();
    this.currentCommentId = comment.id;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    // Scrim
    this.scrim = document.createElement('div');
    this.scrim.className = 'pindrop-sheet-scrim';
    this.scrim.style.touchAction = 'none';
    this.scrim.addEventListener('click', () => this.hide());

    // Sheet
    this.el = document.createElement('div');
    this.el.className = 'pindrop-sheet';
    this.el.style.pointerEvents = 'auto';

    // Handle
    const handle = document.createElement('div');
    handle.className = 'pindrop-sheet-handle';
    const pill = document.createElement('div');
    pill.className = 'pindrop-sheet-handle-pill';
    handle.appendChild(pill);
    this.el.appendChild(handle);
    addSwipeToDismiss(handle, this.el, (isSwipe) => this.hide(isSwipe));

    // Titlebar (reuse popover titlebar classes)
    const titlebar = document.createElement('div');
    titlebar.className = 'pindrop-popover-titlebar';

    const titleLabel = document.createElement('span');
    titleLabel.textContent = 'Comment';
    titlebar.appendChild(titleLabel);

    const actions = document.createElement('div');
    actions.className = 'pindrop-popover-titlebar-actions';

    if (!this.readOnly) {
      const resolveBtn = document.createElement('button');
      resolveBtn.className = 'pindrop-popover-titlebar-btn';
      resolveBtn.innerHTML = comment.resolved ? ICON_RESOLVED : ICON_RESOLVE;
      resolveBtn.title = comment.resolved ? 'Reopen' : 'Resolve';
      resolveBtn.setAttribute('aria-label', comment.resolved ? 'Reopen' : 'Resolve');
      resolveBtn.addEventListener('click', () => {
        if (comment.resolved) {
          this.callbacks.onReopen(comment.id);
        } else {
          this.callbacks.onResolve(comment.id);
          this.hide();
        }
      });

      const moreBtn = document.createElement('button');
      moreBtn.className = 'pindrop-popover-titlebar-btn';
      moreBtn.innerHTML = ICON_MORE;
      moreBtn.title = 'More';
      moreBtn.setAttribute('aria-label', 'More options');
      moreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMenu(comment.id, moreBtn);
      });
      actions.appendChild(moreBtn);
      actions.appendChild(resolveBtn);
    }

    const closeBtn = document.createElement('button');
    closeBtn.className = 'pindrop-popover-titlebar-btn';
    closeBtn.innerHTML = ICON_CLOSE;
    closeBtn.title = 'Close';
    closeBtn.setAttribute('aria-label', 'Close comment');
    closeBtn.addEventListener('click', () => this.hide());
    actions.appendChild(closeBtn);

    titlebar.appendChild(actions);
    this.el.appendChild(titlebar);

    // Scrollable threads area
    const scroll = document.createElement('div');
    scroll.className = 'pindrop-sheet-scroll';

    const threads = document.createElement('div');
    threads.className = 'pindrop-popover-threads';

    threads.appendChild(this.createRow(comment.author, comment.createdAt, comment.text, {
      isOwn: comment.author === this.currentUser,
      canDelete: false,
      onEdit: (newText) => { this.callbacks.onEditComment(comment.id, newText); },
    }, comment.meta?.source === 'agent'));

    for (const reply of comment.replies) {
      threads.appendChild(this.createRow(reply.author, reply.createdAt, reply.text, {
        isOwn: reply.author === this.currentUser,
        canDelete: true,
        onEdit: (newText) => { this.callbacks.onEditReply(comment.id, reply.id, newText); },
        onDelete: () => { this.callbacks.onDeleteReply(comment.id, reply.id); },
      }));
    }

    scroll.appendChild(threads);

    if (comment.resolved && comment.resolvedBy) {
      const resolvedRow = document.createElement('div');
      resolvedRow.className = 'pindrop-popover-resolved-row';
      resolvedRow.innerHTML = `<span>${ICON_RESOLVED}</span><span>${this.escapeHtml(comment.resolvedBy)} marked this as resolved</span>`;
      scroll.appendChild(resolvedRow);
    }

    this.el.appendChild(scroll);

    // Reply area
    if (!this.readOnly) {
      const replyArea = document.createElement('div');
      replyArea.className = 'pindrop-popover-reply-area';

      const avatar = document.createElement('div');
      avatar.className = 'pindrop-popover-avatar-small';
      avatar.textContent = this.currentUser ? this.currentUser.charAt(0).toUpperCase() : '?';
      if (this.currentUser) avatar.style.background = avatarColor(this.currentUser);
      replyArea.appendChild(avatar);

      const wrap = document.createElement('div');
      wrap.className = 'pindrop-input-wrap';

      const textarea = document.createElement('textarea');
      textarea.placeholder = 'Reply...';
      textarea.rows = 1;

      const sendBtn = document.createElement('button');
      sendBtn.className = 'pindrop-send-btn';
      sendBtn.innerHTML = ICON_SEND;
      sendBtn.disabled = true;

      textarea.addEventListener('input', () => {
        const hasContent = !!textarea.value.trim();
        sendBtn.disabled = !hasContent;
        wrap.classList.toggle('has-content', hasContent);
        textarea.style.height = 'auto';
        textarea.style.height = hasContent ? `${textarea.scrollHeight}px` : '';
      });

      const send = () => {
        if (!textarea.value.trim()) return;
        this.callbacks.onReply(comment.id, textarea.value.trim());
        textarea.value = '';
        textarea.style.height = 'auto';
        sendBtn.disabled = true;
        wrap.classList.remove('has-content');
      };

      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && textarea.value.trim()) {
          e.preventDefault();
          send();
        }
        e.stopPropagation();
      });

      sendBtn.addEventListener('click', send);

      wrap.append(textarea, sendBtn);
      replyArea.appendChild(wrap);
      this.el.appendChild(replyArea);
    }

    this.shadowContent.appendChild(this.scrim);
    this.shadowContent.appendChild(this.el);
  }

  showNewComment(): void {
    this.hide();
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    // Scrim
    this.scrim = document.createElement('div');
    this.scrim.className = 'pindrop-sheet-scrim';
    this.scrim.style.touchAction = 'none';
    this.scrim.addEventListener('click', () => this.hide());

    // Sheet
    this.el = document.createElement('div');
    this.el.className = 'pindrop-sheet';
    this.el.style.pointerEvents = 'auto';

    // Handle
    const handle = document.createElement('div');
    handle.className = 'pindrop-sheet-handle';
    const pill = document.createElement('div');
    pill.className = 'pindrop-sheet-handle-pill';
    handle.appendChild(pill);
    this.el.appendChild(handle);
    addSwipeToDismiss(handle, this.el, (isSwipe) => this.hide(isSwipe));

    // Titlebar
    const titlebar = document.createElement('div');
    titlebar.className = 'pindrop-popover-titlebar';

    const titleLabel = document.createElement('span');
    titleLabel.textContent = 'New Comment';
    titlebar.appendChild(titleLabel);

    const actions = document.createElement('div');
    actions.className = 'pindrop-popover-titlebar-actions';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'pindrop-popover-titlebar-btn';
    closeBtn.innerHTML = ICON_CLOSE;
    closeBtn.title = 'Close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.addEventListener('click', () => this.hide());
    actions.appendChild(closeBtn);

    titlebar.appendChild(actions);
    this.el.appendChild(titlebar);

    // Input Area
    const inputArea = document.createElement('div');
    inputArea.style.cssText = 'padding:12px 16px 16px;';

    const wrap = document.createElement('div');
    wrap.className = 'pindrop-input-wrap';

    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Add a comment...';
    textarea.rows = 1;

    const btn = document.createElement('button');
    btn.className = 'pindrop-send-btn';
    btn.innerHTML = ICON_SEND;
    btn.disabled = true;

    textarea.addEventListener('input', () => {
      const hasContent = !!textarea.value.trim();
      btn.disabled = !hasContent;
      wrap.classList.toggle('has-content', hasContent);
      textarea.style.height = 'auto';
      textarea.style.height = hasContent ? `${textarea.scrollHeight}px` : '';
    });

    const save = () => {
      const text = textarea.value.trim();
      if (!text) return;
      this.callbacks.onSaveNewComment?.(text);
    };

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && textarea.value.trim()) {
        e.preventDefault();
        save();
      }
      if (e.key === 'Escape') {
        this.hide();
      }
      e.stopPropagation();
    });

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      save();
    });

    wrap.append(textarea, btn);
    inputArea.appendChild(wrap);
    this.el.appendChild(inputArea);

    this.shadowContent.appendChild(this.scrim);
    this.shadowContent.appendChild(this.el);

    // Focus input after layout
    setTimeout(() => textarea.focus(), 50);
  }

  hide(isSwipe = false): void {
    if (!this.el) return;

    const el = this.el;
    const scrim = this.scrim;

    this.el = null;
    this.scrim = null;
    this.currentCommentId = null;

    this.callbacks.onClose?.();

    if (!isSwipe) {
      el.classList.add('pindrop-sheet-closing');
    }
    scrim?.classList.add('pindrop-sheet-closing');

    setTimeout(() => {
      el.remove();
      scrim?.remove();
      if (!this.shadowContent.querySelector('.pindrop-sheet, .pindrop-sidebar-sheet')) {
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      }
    }, 220);
  }

  isVisible(): boolean {
    return this.el !== null;
  }

  getCurrentCommentId(): string | null {
    return this.currentCommentId;
  }

  // No-op on mobile sheet — position is always bottom of screen
  updatePosition(_position: { x: number; y: number }): void { }

  private toggleMenu(commentId: string, anchor: HTMLElement): void {
    if (this.menu) {
      this.hideMenu();
      return;
    }

    this.menu = document.createElement('div');
    this.menu.className = 'pindrop-popover-menu';

    const items = [
      { label: 'Mark as unread', action: () => { this.callbacks.onMarkUnread(commentId); this.hide(); } },
      { label: 'Delete', action: () => { this.callbacks.onDelete(commentId); this.hide(); } },
    ];

    for (const item of items) {
      const btn = document.createElement('button');
      btn.className = 'pindrop-popover-menu-item';
      btn.textContent = item.label;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        item.action();
      });
      this.menu.appendChild(btn);
    }

    const rect = anchor.getBoundingClientRect();
    const sheetRect = this.el!.getBoundingClientRect();
    this.menu.style.top = `${rect.bottom - sheetRect.top + 4}px`;
    this.menu.style.right = `${sheetRect.right - rect.right}px`;

    this.el!.appendChild(this.menu);

    const onOutside = (e: MouseEvent) => {
      if (!this.menu?.contains(e.target as Node)) {
        this.hideMenu();
        this.shadowContent.removeEventListener('click', onOutside);
      }
    };
    setTimeout(() => this.shadowContent.addEventListener('click', onOutside), 0);
  }

  private hideMenu(): void {
    this.menu?.remove();
    this.menu = null;
  }

  private createRow(
    author: string,
    createdAt: string,
    text: string,
    actions?: { isOwn: boolean; canDelete: boolean; onEdit: (newText: string) => void; onDelete?: () => void },
    isAgent = false,
  ): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'pindrop-popover-row';

    const avatar = document.createElement('div');
    avatar.className = 'pindrop-popover-avatar';
    avatar.textContent = author.charAt(0).toUpperCase();
    avatar.style.background = avatarColor(author);
    row.appendChild(avatar);

    const nameRow = document.createElement('div');
    nameRow.className = 'pindrop-popover-name';
    const agentBadge = isAgent ? `<span class="pindrop-agent-badge">${ICON_AGENT}Agent</span>` : '';
    nameRow.innerHTML = `<strong>${this.escapeHtml(author)}</strong>${agentBadge}<span class="pindrop-time">${this.formatTime(createdAt)}</span>`;

    const body = document.createElement('div');
    body.className = 'pindrop-popover-body';
    body.textContent = text;

    if (actions?.isOwn && !this.readOnly) {
      const moreBtn = document.createElement('button');
      moreBtn.className = 'pindrop-row-action-btn';
      moreBtn.innerHTML = ICON_MORE;
      moreBtn.title = 'More';

      const actionsWrap = document.createElement('span');
      actionsWrap.className = 'pindrop-row-actions';
      actionsWrap.appendChild(moreBtn);
      nameRow.appendChild(actionsWrap);

      moreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showRowMenu(row, moreBtn, nameRow, avatar, body, text, actions);
      });
    }

    const contentWrap = document.createElement('div');
    contentWrap.className = 'pindrop-popover-contentWrap';
    contentWrap.append(nameRow, body);
    row.appendChild(contentWrap);

    return row;
  }

  private showRowMenu(
    row: HTMLDivElement,
    anchor: HTMLElement,
    nameRow: HTMLDivElement,
    avatar: HTMLDivElement,
    body: HTMLDivElement,
    text: string,
    actions: { canDelete: boolean; onEdit: (newText: string) => void; onDelete?: () => void }
  ): void {
    this.hideMenu();
    this.activeRowMenu?.remove();
    this.activeRowMenu = null;

    const menu = document.createElement('div');
    menu.className = 'pindrop-popover-menu';

    const editItem = document.createElement('button');
    editItem.className = 'pindrop-popover-menu-item';
    editItem.textContent = 'Edit';
    editItem.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.remove();
      this.startEditing(row, nameRow, avatar, body, text, actions.onEdit);
    });
    menu.appendChild(editItem);

    if (actions.canDelete && actions.onDelete) {
      const deleteItem = document.createElement('button');
      deleteItem.className = 'pindrop-popover-menu-item';
      deleteItem.textContent = 'Delete';
      deleteItem.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.remove();
        actions.onDelete!();
      });
      menu.appendChild(deleteItem);
    }

    const rect = anchor.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    menu.style.position = 'absolute';
    menu.style.top = `${rect.bottom - rowRect.top + 2}px`;
    menu.style.right = '0';
    row.style.position = 'relative';
    row.appendChild(menu);
    this.activeRowMenu = menu;

    const onOutside = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) {
        menu.remove();
        if (this.activeRowMenu === menu) this.activeRowMenu = null;
        this.shadowContent.removeEventListener('click', onOutside);
      }
    };
    setTimeout(() => this.shadowContent.addEventListener('click', onOutside), 0);
  }

  private startEditing(
    row: HTMLDivElement,
    nameRow: HTMLDivElement,
    avatar: HTMLDivElement,
    body: HTMLDivElement,
    originalText: string,
    onSave: (newText: string) => void
  ): void {
    nameRow.style.display = 'none';
    body.style.display = 'none';

    const editContainer = document.createElement('div');
    editContainer.className = 'pindrop-edit-container';

    const textarea = document.createElement('textarea');
    textarea.className = 'pindrop-edit-textarea';
    textarea.value = originalText;
    textarea.rows = 1;

    const btnRow = document.createElement('div');
    btnRow.className = 'pindrop-edit-actions';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'pindrop-edit-save';
    saveBtn.textContent = 'Save';
    saveBtn.disabled = !originalText.trim();

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'pindrop-edit-cancel';
    cancelBtn.textContent = 'Cancel';

    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
      saveBtn.disabled = !textarea.value.trim();
    });

    const restore = () => {
      nameRow.style.display = '';
      body.style.display = '';
      editContainer.remove();
    };

    const save = () => {
      const newText = textarea.value.trim();
      if (!newText) return;
      onSave(newText);
      body.textContent = newText;
      restore();
    };

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && textarea.value.trim()) {
        e.preventDefault();
        save();
      }
      if (e.key === 'Escape') {
        restore();
      }
      e.stopPropagation();
    });

    saveBtn.addEventListener('click', save);
    cancelBtn.addEventListener('click', restore);

    btnRow.append(cancelBtn, saveBtn);
    editContainer.append(textarea, btnRow);
    body.parentElement!.appendChild(editContainer);

    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
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
}
