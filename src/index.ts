import type { PindropOptions, PindropEvent, PindropEventMap, PindropMode, Comment, ImportResult } from './core/types';
import { EventEmitter } from './core/events';
import { Store } from './core/store';
import { createContainer, destroyContainer, type ContainerElements } from './ui/container';
import { PinRenderer } from './ui/pins';
import { Toolbar } from './ui/toolbar';
import { Popover } from './ui/popover';
import { Sidebar } from './ui/sidebar';
import { NamePrompt } from './ui/name-prompt';
import { ConfirmModal } from './ui/confirm-modal';
import { KeyboardHandler } from './ui/keyboard';
import { AnchorTracker } from './anchoring/tracker';
import { createAnchor } from './anchoring/position';
import { resolveAnchorPosition } from './anchoring/position';
import { exportComments, importComments, openFilePicker } from './io/file';
import { detectTheme, applyTheme } from './styles/theme';
import { PIN_COLOR, COMMENT_CURSOR, pinSvgHtml } from './styles/tokens';

class PindropLayer {
  private events: EventEmitter;
  private store: Store;
  private container: ContainerElements;
  private pinRenderer: PinRenderer;
  private toolbar: Toolbar;
  private popover: Popover;
  private sidebar: Sidebar;
  private namePrompt: NamePrompt;
  private confirmModal: ConfirmModal;
  private keyboard: KeyboardHandler;
  private tracker: AnchorTracker;
  private mode: PindropMode = 'view';
  private currentUser: string | null = null;
  private options: Required<Pick<PindropOptions, 'zIndex' | 'readOnly' | 'position' | 'storageKey'>> & PindropOptions;
  private hidden = false;
  private currentPinIndex = -1;
  private themePref: 'auto' | 'light' | 'dark' = 'auto';
  private highlightedEl: HTMLElement | null = null;
  private savedOutline = '';
  private newCommentEl: HTMLDivElement | null = null;
  private newCommentAnchor: ReturnType<typeof createAnchor> | null = null;
  private sidebarSide: 'left' | 'right' = 'right';

  constructor(opts: PindropOptions = {}) {
    this.options = {
      zIndex: opts.zIndex ?? 10000,
      readOnly: opts.readOnly ?? false,
      position: opts.position ?? 'right',
      storageKey: opts.storageKey ?? 'pindrop',
      ...opts,
    };

    // Pre-set user if provided
    if (opts.user?.name) {
      this.currentUser = opts.user.name;
    }
    // (popover.setUser is called after popover is constructed below)

    // Core
    this.events = new EventEmitter();
    this.store = new Store(this.events);
    this.store.enablePersistence(this.options.storageKey, this.options.adapter).then(() => {
      this.refreshUI();
    });

    // UI container
    this.container = createContainer({ zIndex: this.options.zIndex });

    // Theme setup
    if (opts.theme) this.themePref = opts.theme;
    try {
      const savedTheme = localStorage.getItem(`${this.options.storageKey}-theme`);
      if (savedTheme === 'auto' || savedTheme === 'light' || savedTheme === 'dark') {
        this.themePref = savedTheme;
      }
    } catch {}

    const theme = detectTheme(this.themePref);
    applyTheme(this.container.root, theme, this.options.styles);

    window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (this.themePref === 'auto') {
        applyTheme(this.container.root, detectTheme('auto'), this.options.styles);
        this.pinRenderer?.renderAll();
      }
    });

    // Name prompt
    this.namePrompt = new NamePrompt(this.container.shadowContent);
    this.confirmModal = new ConfirmModal(this.container.shadowContent);

    // Pin renderer
    this.pinRenderer = new PinRenderer(this.container.pinContainer, this.store, {
      zIndex: this.options.zIndex,
      onPinClick: (commentId) => this.onPinClick(commentId),
    });
    this.pinRenderer.setShadowHost(this.container.root);

    // Popover
    this.popover = new Popover(this.container.shadowContent, {
      onReply: (commentId, text) => this.handleAddReply(commentId, text),
      onResolve: (commentId) => this.handleResolveComment(commentId),
      onReopen: (commentId) => this.handleReopenComment(commentId),
      onDelete: (commentId) => this.handleDeleteComment(commentId),
      onMarkUnread: (commentId) => this.markUnread(commentId),
      onEditComment: (commentId, text) => this.editComment(commentId, text),
      onEditReply: (commentId, replyId, text) => this.editReply(commentId, replyId, text),
      onDeleteReply: (commentId, replyId) => this.deleteReply(commentId, replyId),
      onClose: () => { this.pinRenderer.setActiveComment(null); this.sidebar.setActiveComment(null); },
    });
    this.popover.setReadOnly(this.options.readOnly);
    if (this.currentUser) this.popover.setUser(this.currentUser);

    // Toolbar
    this.toolbar = new Toolbar({
      onSetMode: (mode) => this.setMode(mode),
      onExport: () => this.handleExport(),
      onImport: () => this.handleImport(),
      onChangeName: () => this.handleChangeName(),
      onClearAll: () => this.handleClearAll(),
      onHide: () => this.handleHide(),
      onPositionChange: (side, locked) => {
        if (side) { this.sidebarSide = side; this.sidebar.setPosition(side, locked); }
        else { this.sidebar.setPosition(this.sidebarSide, locked); }
      },
      onSetThemePreference: (pref) => this.setThemePreference(pref),
    });
    this.toolbar.render(this.container.shadowContent);
    this.toolbar.setReadOnly(this.options.readOnly);
    this.toolbar.setThemePreference(this.themePref);

    // Sidebar
    this.sidebar = new Sidebar({
      onCommentClick: (commentId) => this.onSidebarCommentClick(commentId),
      onExport: () => this.handleExport(),
      onImport: () => this.handleImport(),
      onSwitchSide: () => this.handleSidebarSwitch(),
    });
    this.sidebar.render(this.container.shadowContent, this.options.position);
    this.sidebar.setReadOnly(this.options.readOnly);
    this.sidebar.setStorageKey(this.options.storageKey);

    // Load persisted toolbar position (after sidebar is ready)
    this.toolbar.setStorageKey(this.options.storageKey);

    // Keyboard
    this.keyboard = new KeyboardHandler({
      onSetMode: (mode) => this.setMode(mode),
      onEscape: () => this.onEscape(),
      onNextPin: () => this.navigatePin(1),
      onPrevPin: () => this.navigatePin(-1),
    });
    this.keyboard.setReadOnly(this.options.readOnly);
    this.keyboard.attach();

    // Tracker
    this.tracker = new AnchorTracker(this.store, this.events, this.pinRenderer, () => this.updatePopoverPositions());
    this.tracker.start();

    // Overlay handlers for comment placement + hover highlight
    this.container.overlay.addEventListener('click', (e) => this.onOverlayClick(e));
    this.container.overlay.addEventListener('mousemove', (e) => this.onOverlayHover(e));
    this.container.overlay.addEventListener('mouseleave', () => this.clearHighlight());

    // UI will be refreshed async when store finishes loading
  }

  // --- Public API ---

  export(): string {
    return exportComments(this.store, this.events);
  }

  import(json: string): ImportResult {
    const result = importComments(json, this.store, this.events);
    this.refreshUI();
    return result;
  }

  destroy(): void {
    this.keyboard.detach();
    this.tracker.stop();
    this.pinRenderer.destroy();
    this.events.removeAll();
    destroyContainer(this.container);
  }

  toggle(): void {
    this.hidden = !this.hidden;
    this.container.root.style.display = this.hidden ? 'none' : '';
  }

  setUser(user: { name: string }): void {
    this.currentUser = user.name;
    this.popover.setUser(user.name);
  }

  on<E extends PindropEvent>(event: E, callback: (payload: PindropEventMap[E]) => void): () => void {
    return this.events.on(event, callback);
  }

  off<E extends PindropEvent>(event: E, callback: (payload: PindropEventMap[E]) => void): void {
    this.events.off(event, callback);
  }

  addComment(options: { selector: string; text: string; author?: string }): void {
    const el = document.querySelector(options.selector);
    if (!el) {
      console.warn(`Pindrop: Could not find element matching "${options.selector}" for programmatic comment.`);
      return;
    }
    const rect = el.getBoundingClientRect();
    const pageX = rect.left + rect.width / 2 + window.scrollX;
    const pageY = rect.top + rect.height / 2 + window.scrollY;
    const anchor = createAnchor(el, pageX, pageY);

    const now = new Date().toISOString();
    const comment: Comment = {
      id: crypto.randomUUID(),
      anchor,
      author: options.author || this.currentUser || 'Automated Agent',
      text: options.text,
      createdAt: now,
      updatedAt: now,
      resolved: false,
      unread: false,
      replies: [],
    };
    
    this.store.addComment(comment);
    this.refreshUI();
  }

  addReply(options: { commentId: string; text: string; author?: string }): void {
    const parent = this.store.getComment(options.commentId);
    if (!parent) {
      console.warn(`Pindrop: Could not find comment with ID "${options.commentId}" to append programmatic reply.`);
      return;
    }

    const now = new Date().toISOString();
    this.store.addReply(options.commentId, {
      id: crypto.randomUUID(),
      author: options.author || this.currentUser || 'Automated Agent',
      text: options.text,
      createdAt: now,
      updatedAt: now,
    });
    this.sidebar.update(this.store.getComments());

    if (this.popover.getCurrentCommentId() === options.commentId) {
      const pos = resolveAnchorPosition(parent.anchor);
      this.popover.show(parent, { x: pos.x - window.scrollX, y: pos.y - window.scrollY });
    }
  }

  getComments(): Comment[] {
    return this.store.getComments();
  }

  resolveComment(commentId: string, author?: string): void {
    if (!this.store.getComment(commentId)) return;
    this.store.resolveComment(commentId, author || this.currentUser || 'Automated Agent');
    this.refreshUI();
  }

  reopenComment(commentId: string): void {
    if (!this.store.getComment(commentId)) return;
    this.store.reopenComment(commentId);
    this.refreshUI();
    
    if (this.popover.getCurrentCommentId() === commentId) {
      const comment = this.store.getComment(commentId)!;
      const pos = resolveAnchorPosition(comment.anchor);
      this.popover.show(comment, { x: pos.x - window.scrollX, y: pos.y - window.scrollY });
      this.pinRenderer.setActiveComment(commentId);
    }
  }

  deleteComment(commentId: string): void {
    if (!this.store.getComment(commentId)) return;
    this.store.deleteComment(commentId);
    if (this.popover.getCurrentCommentId() === commentId) {
      this.popover.hide();
    }
    this.refreshUI();
  }

  // --- Internal ---

  private setMode(mode: PindropMode): void {
    const prev = this.mode;
    this.mode = mode;

    // Overlay: only in comment mode
    this.container.overlay.style.display = mode === 'comment' ? '' : 'none';
    // Pins: visible in comment + review
    this.container.pinContainer.style.display = mode !== 'view' ? '' : 'none';
    // Sidebar: visible in review mode only
    if (mode === 'review') {
      this.sidebar.show();
    } else {
      this.sidebar.hide();
    }

    this.toolbar.setMode(mode);
    this.pinRenderer.setMode(mode);
    this.events.emit('mode:change', { mode });

    // Clean up when leaving comment mode
    if (prev === 'comment' && mode !== 'comment') {
      this.clearHighlight();
      this.popover.hide();
      this.dismissNewComment();
    }
    // Close popover when entering view (no pins visible)
    if (mode === 'view') {
      this.popover.hide();
      this.pinRenderer.setActiveComment(null);
      this.sidebar.setActiveComment(null);
    }
  }

  private isContentElement(el: Element | null): boolean {
    return !!el && el !== document.body && el !== document.documentElement
      && el !== this.container.root && !this.container.pinContainer.contains(el);
  }

  private onOverlayHover(e: MouseEvent): void {
    if (this.mode !== 'comment') return;

    this.container.overlay.style.display = 'none';
    const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    this.container.overlay.style.display = '';

    if (this.isContentElement(target)) {
      this.container.overlay.style.cursor = COMMENT_CURSOR;
      if (target !== this.highlightedEl) {
        this.clearHighlight();
        this.highlightedEl = target;
        this.savedOutline = target!.style.outline;
        target!.style.outline = `2px solid ${PIN_COLOR}`;
      }
    } else {
      this.container.overlay.style.cursor = 'default';
      this.clearHighlight();
    }
  }

  private clearHighlight(): void {
    if (this.highlightedEl) {
      this.highlightedEl.style.outline = this.savedOutline;
      this.highlightedEl = null;
      this.savedOutline = '';
    }
  }

  private async onOverlayClick(e: MouseEvent): Promise<void> {
    if (this.mode !== 'comment') return;
    this.clearHighlight();

    // Get element under click (temporarily hide overlay)
    this.container.overlay.style.display = 'none';
    const target = document.elementFromPoint(e.clientX, e.clientY);
    this.container.overlay.style.display = '';

    if (!this.isContentElement(target)) return;

    if (!this.currentUser) {
      this.currentUser = await this.namePrompt.prompt(this.options.storageKey);
      if (!this.currentUser) return;
      this.popover.setUser(this.currentUser);
    }

    const pageX = e.clientX + window.scrollX;
    const pageY = e.clientY + window.scrollY;
    const anchor = createAnchor(target as Element, pageX, pageY);

    // Show comment input popover
    this.showNewCommentPopover(anchor, { x: e.clientX, y: e.clientY });
  }

  private showNewCommentPopover(anchor: ReturnType<typeof createAnchor>, position: { x: number; y: number }): void {
    this.popover.hide();
    this.dismissNewComment();

    // Hide the overlay so it can't intercept clicks on the comment box
    this.container.overlay.style.display = 'none';

    // Expand the shadow host to full viewport so shadow DOM content is hit-testable
    // (A 0x0 host causes browsers to skip its shadow DOM during hit-testing)
    this.container.root.style.width = '100vw';
    this.container.root.style.height = '100vh';
    this.container.root.style.pointerEvents = 'none';

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;z-index:2;';

    // Click-outside backdrop to dismiss the comment box
    const backdrop = document.createElement('div');
    backdrop.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:auto;z-index:1;';
    backdrop.addEventListener('click', () => this.dismissNewComment());

    // Large pin at click position
    const pin = document.createElement('div');
    pin.className = 'pindrop-new-pin';
    pin.style.left = `${position.x}px`;
    pin.style.top = `${position.y}px`;
    pin.innerHTML = pinSvgHtml(PIN_COLOR, this.store.getComments().length + 1);

    // Comment box — position left or right of pin based on space
    const box = document.createElement('div');
    box.className = 'pindrop-new-comment-box';
    const boxWidth = 280;
    const pinRight = position.x + 33;
    const spaceRight = window.innerWidth - pinRight;
    let boxLeft: number;
    if (spaceRight > boxWidth + 8) {
      boxLeft = pinRight + 8;
    } else {
      boxLeft = position.x - 3 - boxWidth - 8;
    }
    if (boxLeft < 8) boxLeft = 8;
    box.style.left = `${boxLeft}px`;
    const boxTop = Math.max(8, position.y - 32);
    box.style.top = `${boxTop}px`;

    // Input wrapper — textarea + send button inside
    const wrap = document.createElement('div');
    wrap.className = 'pindrop-input-wrap';

    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Add a comment...';
    textarea.rows = 1;

    const btn = document.createElement('button');
    btn.className = 'pindrop-send-btn';
    btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>`;
    btn.disabled = true;

    textarea.addEventListener('input', () => {
      const hasContent = !!textarea.value.trim();
      btn.disabled = !hasContent;
      wrap.classList.toggle('has-content', hasContent);
      textarea.style.height = 'auto';
      textarea.style.height = hasContent ? `${textarea.scrollHeight}px` : '';
    });

    const save = () => {
      if (!textarea.value.trim()) return;
      const now = new Date().toISOString();
      const comment: Comment = {
        id: crypto.randomUUID(),
        anchor,
        author: this.currentUser!,
        text: textarea.value.trim(),
        createdAt: now,
        updatedAt: now,
        resolved: false,
        unread: false,
        replies: [],
      };
      this.store.addComment(comment);
      this.refreshUI();

      box.classList.add('pindrop-saving');
      pin.classList.add('pindrop-saving');

      setTimeout(() => {
        this.dismissNewComment();
      }, 300);
    };

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && textarea.value.trim()) {
        e.preventDefault();
        save();
      }
      if (e.key === 'Escape') {
        this.dismissNewComment();
      }
      e.stopPropagation();
    });

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      save();
    });

    wrap.append(textarea, btn);
    box.appendChild(wrap);
    wrapper.append(backdrop, pin, box);
    this.container.shadowContent.appendChild(wrapper);
    this.newCommentEl = wrapper;
    this.newCommentAnchor = anchor;
    textarea.focus();
  }

  private dismissNewComment(): void {
    if (this.newCommentEl) {
      this.newCommentEl.remove();
      this.newCommentEl = null;
      this.newCommentAnchor = null;

      // Restore the shadow host to 0x0
      this.container.root.style.width = '0';
      this.container.root.style.height = '0';
      this.container.root.style.pointerEvents = '';

      // Restore the overlay if still in comment mode
      if (this.mode === 'comment') {
        this.container.overlay.style.display = '';
      }
    }
  }

  private onPinClick(commentId: string): void {
    // Toggle: clicking the same pin again closes the popover
    if (this.popover.getCurrentCommentId() === commentId) {
      this.popover.hide();
      this.pinRenderer.setActiveComment(null);
      this.sidebar.setActiveComment(null);
      return;
    }

    const comment = this.store.getComment(commentId);
    if (!comment) return;

    // Dismiss any in-progress new comment
    this.dismissNewComment();
    this.clearHighlight();

    // Mark as read when opening
    if (comment.unread) {
      this.store.markRead(commentId);
      this.pinRenderer.renderAll();
      this.sidebar.update(this.store.getComments());
    }

    const pos = resolveAnchorPosition(comment.anchor);
    this.popover.show(comment, { x: pos.x - window.scrollX, y: pos.y - window.scrollY });
    this.pinRenderer.setActiveComment(commentId);
    this.sidebar.setActiveComment(commentId);
  }

  private onSidebarCommentClick(commentId: string): void {
    const comment = this.store.getComment(commentId);
    if (!comment) return;

    const pos = resolveAnchorPosition(comment.anchor);
    // Scroll into view
    window.scrollTo({ top: pos.y - window.innerHeight / 3, behavior: 'smooth' });

    // Open popover after scroll
    setTimeout(() => {
      this.onPinClick(commentId);
    }, 300);
  }

  private async handleAddReply(commentId: string, text: string): Promise<void> {
    if (!this.currentUser) {
      this.currentUser = await this.namePrompt.prompt(this.options.storageKey);
      if (!this.currentUser) return;
      this.popover.setUser(this.currentUser);
    }

    const now = new Date().toISOString();
    this.store.addReply(commentId, {
      id: crypto.randomUUID(),
      author: this.currentUser,
      text,
      createdAt: now,
      updatedAt: now,
    });

    // Re-show popover with updated data
    const comment = this.store.getComment(commentId);
    if (comment) {
      const pos = resolveAnchorPosition(comment.anchor);
      this.popover.show(comment, { x: pos.x - window.scrollX, y: pos.y - window.scrollY });
    }
    this.sidebar.update(this.store.getComments());
  }

  private async handleResolveComment(commentId: string): Promise<void> {
    if (!this.currentUser) {
      this.currentUser = await this.namePrompt.prompt(this.options.storageKey);
      if (!this.currentUser) return;
      this.popover.setUser(this.currentUser);
    }
    this.store.resolveComment(commentId, this.currentUser);
    this.refreshUI();
  }

  private handleReopenComment(commentId: string): void {
    this.store.reopenComment(commentId);
    this.refreshUI();

    // Re-show popover with updated state
    const comment = this.store.getComment(commentId);
    if (comment) {
      const pos = resolveAnchorPosition(comment.anchor);
      this.popover.show(comment, { x: pos.x - window.scrollX, y: pos.y - window.scrollY });
      this.pinRenderer.setActiveComment(commentId);
    }
  }

  private handleDeleteComment(commentId: string): void {
    this.store.deleteComment(commentId);
    this.popover.hide();
    this.refreshUI();
  }

  private editComment(commentId: string, text: string): void {
    this.store.editComment(commentId, text);
    this.sidebar.update(this.store.getComments());
  }

  private editReply(commentId: string, replyId: string, text: string): void {
    this.store.editReply(commentId, replyId, text);
  }

  private deleteReply(commentId: string, replyId: string): void {
    this.store.deleteReply(commentId, replyId);
    // Re-show popover with updated data
    const comment = this.store.getComment(commentId);
    if (comment) {
      const pos = resolveAnchorPosition(comment.anchor);
      this.popover.show(comment, { x: pos.x - window.scrollX, y: pos.y - window.scrollY });
      this.pinRenderer.setActiveComment(commentId);
    }
  }

  private markUnread(commentId: string): void {
    this.store.markUnread(commentId);
    this.refreshUI();
  }

  private navigatePin(direction: number): void {
    const comments = this.store.getComments();
    if (comments.length === 0) return;

    this.currentPinIndex += direction;
    if (this.currentPinIndex < 0) this.currentPinIndex = comments.length - 1;
    if (this.currentPinIndex >= comments.length) this.currentPinIndex = 0;

    this.onSidebarCommentClick(comments[this.currentPinIndex].id);
  }

  private onEscape(): void {
    if (this.popover.isVisible()) {
      this.popover.hide();
      this.pinRenderer.setActiveComment(null);
      this.sidebar.setActiveComment(null);
    } else if (this.mode !== 'view') {
      this.setMode('view');
    }
  }

  private async handleExport(): Promise<void> {
    const count = this.store.getComments().length;
    const confirmed = await this.confirmModal.show({
      title: 'Share comments',
      description: `Download ${count} comment${count !== 1 ? 's' : ''} as a file you can share with your team over email or chat.`,
      confirmLabel: 'Download file',
    });
    if (confirmed) this.export();
  }

  private async handleImport(): Promise<void> {
    const confirmed = await this.confirmModal.show({
      title: 'Load comments',
      description: 'Open a comment file shared by a teammate. Their comments will be added alongside yours.',
      confirmLabel: 'Choose file',
    });
    if (!confirmed) return;
    try {
      const json = await openFilePicker();
      this.import(json);
    } catch {
      // User cancelled file picker
    }
  }

  private async handleChangeName(): Promise<void> {
    const name = await this.namePrompt.edit(this.options.storageKey);
    if (!name) return;
    this.currentUser = name;
    this.popover.setUser(name);
  }

  private async handleClearAll(): Promise<void> {
    const count = this.store.getComments().length;
    if (count === 0) return;
    const confirmed = await this.confirmModal.show({
      title: 'Clear all comments',
      description: `This will permanently delete ${count} comment${count !== 1 ? 's' : ''} from this page. This can't be undone.`,
      confirmLabel: 'Delete all',
      destructive: true,
    });
    if (!confirmed) return;
    this.store.clear();
    this.popover.hide();
    this.refreshUI();
  }

  private handleHide(): void {
    this.setMode('view');
    this.container.root.style.display = 'none';
  }

  private handleSidebarSwitch(): void {
    this.sidebarSide = this.sidebarSide === 'right' ? 'left' : 'right';
    this.sidebar.setPosition(this.sidebarSide);
  }

  private setThemePreference(pref: 'auto' | 'light' | 'dark'): void {
    this.themePref = pref;
    this.toolbar.setThemePreference(pref);
    try {
      localStorage.setItem(`${this.options.storageKey}-theme`, pref);
    } catch {}
    
    applyTheme(this.container.root, detectTheme(pref), this.options.styles);
    this.pinRenderer?.renderAll();
  }

  private refreshUI(): void {
    const comments = this.store.getComments();
    this.pinRenderer.renderAll();
    this.sidebar.update(comments);
    this.toolbar.setCommentCount(comments.length);
  }

  private updatePopoverPositions(): void {
    // Existing comment popover
    const commentId = this.popover.getCurrentCommentId();
    if (commentId) {
      const comment = this.store.getComment(commentId);
      if (comment) {
        const pos = resolveAnchorPosition(comment.anchor);
        this.popover.updatePosition({ x: pos.x - window.scrollX, y: pos.y - window.scrollY });
      }
    }

    // New comment popover (if active)
    if (this.newCommentEl && this.newCommentAnchor) {
      const pos = resolveAnchorPosition(this.newCommentAnchor);
      const viewportX = pos.x - window.scrollX;
      const viewportY = pos.y - window.scrollY;

      const pin = this.newCommentEl.children[1] as HTMLElement | undefined;
      const box = this.newCommentEl.children[2] as HTMLElement | undefined;
      
      if (pin && box) {
        pin.style.left = `${viewportX}px`;
        pin.style.top = `${viewportY}px`;

        const boxWidth = 280;
        const pinRight = viewportX + 33;
        const spaceRight = window.innerWidth - pinRight;
        let boxLeft = spaceRight > boxWidth + 8 ? pinRight + 8 : viewportX - 3 - boxWidth - 8;
        if (boxLeft < 8) boxLeft = 8;
        box.style.left = `${boxLeft}px`;
        const boxTop = Math.max(8, viewportY - 32);
        box.style.top = `${boxTop}px`;
      }
    }
  }
}

export const Pindrop = {
  init(options?: PindropOptions): PindropLayer {
    return new PindropLayer(options);
  },
};

export type { PindropOptions, PindropMode, Comment, ImportResult, PindropEvent, PindropEventMap };