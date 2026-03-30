import type { Comment } from '../core/types';
import { avatarColor, ICON_AGENT } from '../styles/tokens';

// Lucide icon paths (24x24)
const svgBtn = (inner: string) => `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
const ICON_RESOLVE = svgBtn(`<path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/><path d="m9 12 2 2 4-4"/>`);
const ICON_RESOLVED = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/><path d="m9 12 2 2 4-4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
const ICON_CLOSE = svgBtn(`<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`);
const ICON_MORE = svgBtn(`<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>`);
const ICON_SEND = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>`;
const ICON_EDIT = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>`;
const ICON_TRASH = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>`;

export interface PopoverCallbacks {
  onReply: (commentId: string, text: string) => void;
  onResolve: (commentId: string) => void;
  onReopen: (commentId: string) => void;
  onDelete: (commentId: string) => void;
  onMarkUnread: (commentId: string) => void;
  onEditComment: (commentId: string, text: string) => void;
  onEditReply: (commentId: string, replyId: string, text: string) => void;
  onDeleteReply: (commentId: string, replyId: string) => void;
  onClose?: () => void;
}

export class Popover {
  private el: HTMLDivElement | null = null;
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

  show(comment: Comment, position: { x: number; y: number }): void {
    this.hide();
    this.currentCommentId = comment.id;

    this.el = document.createElement('div');
    this.el.className = 'pindrop-popover';
    this.el.style.pointerEvents = 'auto';
    this.el.tabIndex = -1; // Allow focus routing

    this.updatePosition(position);

    // Titlebar
    const titlebar = document.createElement('div');
    titlebar.className = 'pindrop-popover-titlebar';

    const titleLabel = document.createElement('span');
    titleLabel.textContent = 'Comment';
    titlebar.appendChild(titleLabel);

    const actions = document.createElement('div');
    actions.className = 'pindrop-popover-titlebar-actions';

    if (!this.readOnly) {
      // Resolve / Reopen
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
      // More menu
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

    // Threads container
    const threads = document.createElement('div');
    threads.className = 'pindrop-popover-threads';

    // Main comment row (no delete for initial comment)
    threads.appendChild(this.createRow(comment.author, comment.createdAt, comment.text, {
      isOwn: comment.author === this.currentUser,
      canDelete: false,
      onEdit: (newText) => { this.callbacks.onEditComment(comment.id, newText); },
    }, comment.meta?.source === 'agent'));

    // Replies
    for (const reply of comment.replies) {
      threads.appendChild(this.createRow(reply.author, reply.createdAt, reply.text, {
        isOwn: reply.author === this.currentUser,
        canDelete: true,
        onEdit: (newText) => { this.callbacks.onEditReply(comment.id, reply.id, newText); },
        onDelete: () => { this.callbacks.onDeleteReply(comment.id, reply.id); },
      }));
    }

    this.el.appendChild(threads);

    // Resolved indicator
    if (comment.resolved && comment.resolvedBy) {
      const resolvedRow = document.createElement('div');
      resolvedRow.className = 'pindrop-popover-resolved-row';
      resolvedRow.innerHTML = `<span>${ICON_RESOLVED}</span><span>${this.escapeHtml(comment.resolvedBy)} marked this as resolved</span>`;
      this.el.appendChild(resolvedRow);
    }

    // Reply input area — auto-grow textarea with send button
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

    this.shadowContent.appendChild(this.el);
    this.el.focus();
  }

  hide(): void {
    this.hideMenu();
    const wasVisible = this.el !== null;
    this.el?.remove();
    this.el = null;
    this.currentCommentId = null;
    if (wasVisible) this.callbacks.onClose?.();
  }

  isVisible(): boolean {
    return this.el !== null;
  }

  getCurrentCommentId(): string | null {
    return this.currentCommentId;
  }

  updatePosition(position: { x: number; y: number }): void {
    if (!this.el) return;
    const pinRight = position.x + 33;
    const popoverWidth = 360;
    const spaceRight = window.innerWidth - pinRight;
    let left = spaceRight > popoverWidth + 8
      ? pinRight + 8
      : position.x - 3 - popoverWidth - 8;
      
    let documentLeft = left + window.scrollX;
    if (documentLeft < 8) documentLeft = 8;
    left = documentLeft - window.scrollX;

    let documentTop = position.y - 32 + window.scrollY;
    if (documentTop < 8) documentTop = 8;
    let top = documentTop - window.scrollY;

    this.el.style.left = `${left}px`;
    this.el.style.top = `${top}px`;
  }

  setReadOnly(readOnly: boolean): void {
    this.readOnly = readOnly;
  }

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

    // Position below the anchor button, right-aligned with icon
    const rect = anchor.getBoundingClientRect();
    const popoverRect = this.el!.getBoundingClientRect();
    this.menu.style.top = `${rect.bottom - popoverRect.top + 4}px`;
    this.menu.style.right = `${popoverRect.right - rect.right}px`;

    this.el!.appendChild(this.menu);

    // Close on outside click
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

    // Avatar
    const avatar = document.createElement('div');
    avatar.className = 'pindrop-popover-avatar';
    avatar.textContent = author.charAt(0).toUpperCase();
    avatar.style.background = avatarColor(author);
    row.appendChild(avatar);

    // Name + timestamp + more menu
    const nameRow = document.createElement('div');
    nameRow.className = 'pindrop-popover-name';
    const agentBadge = isAgent ? `<span class="pindrop-agent-badge">${ICON_AGENT}Agent</span>` : '';
    nameRow.innerHTML = `<strong>${this.escapeHtml(author)}</strong>${agentBadge}<span class="pindrop-time">${this.formatTime(createdAt)}</span>`;

    // Text
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

    row.append(nameRow, body);

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
    // Close any existing menus
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

    // Position below the anchor, right-aligned
    const rect = anchor.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    menu.style.position = 'absolute';
    menu.style.top = `${rect.bottom - rowRect.top + 2}px`;
    menu.style.right = '0';
    row.style.position = 'relative';
    row.appendChild(menu);
    this.activeRowMenu = menu;

    // Close on outside click
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
    row.appendChild(editContainer);

    // Auto-size and focus
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
