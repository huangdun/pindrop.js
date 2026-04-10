import type { PindropOptions, PindropEvent, PindropEventMap, PindropMode, Comment, CommentMeta, CommentableElement, Reply, ImportResult, CommentScope } from './core/types';
import './styles/styles.css';
import { EventEmitter } from './core/events';
import { Store } from './core/store';
import { filterVisibleComments, getCommentVisibility, isElementVisible } from './core/visibility';
import { createContainer, destroyContainer, type ContainerElements } from './ui/container';
import { PinRenderer } from './ui/pins';
import { Toolbar } from './ui/toolbar';
import { Popover } from './ui/popover';
import { BottomSheet } from './ui/bottom-sheet';
import { Sidebar } from './ui/sidebar';
import { NamePrompt } from './ui/name-prompt';
import { ConfirmModal } from './ui/confirm-modal';
import { KeyboardHandler } from './ui/keyboard';
import { AnchorTracker } from './anchoring/tracker';
import { createAnchor, resolveAnchorPosition } from './anchoring/position';
import { generateSelector } from './anchoring/selector';
import { exportComments, importComments, openFilePicker } from './io/file';
import { mergeComments } from './io/merge';
import { detectTheme, applyTheme } from './styles/theme';
import { PIN_COLOR, COMMENT_CURSOR, pinSvgHtml } from './styles/tokens';
import { addSwipeToDismiss } from './ui/swipe';
import { applyRevealAdapter } from './adapters/reveal';
import { applyImpressAdapter } from './adapters/impress';
import { applyShowerAdapter } from './adapters/shower';

class PindropLayer {
  private events: EventEmitter;
  private store: Store;
  private container: ContainerElements;
  private pinRenderer: PinRenderer;
  private toolbar: Toolbar;
  private popover: Popover;
  private sheet!: BottomSheet;
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
  private newCommentScope: CommentScope | undefined;
  private sidebarSide: 'left' | 'right' = 'right';
  private _dragWasPopoverOpen = false;
  private adapterCleanups: Array<() => void> = [];

  constructor(opts: PindropOptions = {}) {
    this.options = {
      zIndex: opts.zIndex ?? 10000,
      readOnly: opts.readOnly ?? false,
      position: opts.position ?? 'right',
      storageKey: opts.storageKey ?? 'pindrop',
      ...opts,
    };

    const adapterCallbacks = {
      refresh: () => this.refresh(),
      hidePins: () => { this.container.pinContainer.style.visibility = 'hidden'; },
    };
    [applyRevealAdapter, applyImpressAdapter, applyShowerAdapter].forEach(apply => {
      const cleanup = apply(this.options, adapterCallbacks);
      if (cleanup) this.adapterCleanups.push(cleanup);
    });

    // Pre-set user if provided or saved in local storage
    if (opts.user?.name) {
      this.currentUser = opts.user.name;
    } else {
      try {
        const savedName = localStorage.getItem(`${this.options.storageKey}-user`);
        if (savedName) this.currentUser = savedName;
      } catch (e) {
        // Ignore storage errors
      }
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
        this.pinRenderer?.renderAll(this.getVisibleComments());
      }
    });

    // Name prompt
    this.namePrompt = new NamePrompt(this.container.shadowContent);
    this.confirmModal = new ConfirmModal(this.container.shadowContent);

    // Pin renderer
    this.pinRenderer = new PinRenderer(this.container.pinContainer, this.store, {
      zIndex: this.options.zIndex,
      onPinClick: (commentId) => this.onPinClick(commentId),
      onPinMove: (commentId, clientX, clientY, pageX, pageY) => {
        this.clearHighlight();
        const els = document.elementsFromPoint(clientX, clientY);
        const target = els.find(el => this.isContentElement(el)) as HTMLElement | undefined;
        if (!target) return;
        const newAnchor = createAnchor(target, pageX, pageY);
        this.store.moveAnchor(commentId, newAnchor, this.options.getScope?.(target));
        this.refreshUI();
      },
      onPinDragOver: (clientX, clientY) => {
        const els = document.elementsFromPoint(clientX, clientY);
        const target = els.find(el => this.isContentElement(el)) as HTMLElement | undefined;
        if (!target) { this.clearHighlight(); return; }
        if (target !== this.highlightedEl) {
          this.clearHighlight();
          this.highlightedEl = target;
          this.savedOutline = target.style.outline;
          target.style.outline = `2px solid ${PIN_COLOR}`;
        }
      },
      onPinDragStart: (commentId) => {
        // Remember if this pin's popover was open before the drag
        this._dragWasPopoverOpen = this.getViewerCommentId() === commentId;
        this.hideViewer();
      },
      onPinDragEnd: (commentId) => {
        // Only re-open the popover if it was open before the drag started
        if (this._dragWasPopoverOpen) {
          const comment = this.store.getComment(commentId);
          if (comment) {
            const pos = resolveAnchorPosition(comment.anchor);
            this.showViewer(comment, { x: pos.x - window.scrollX, y: pos.y - window.scrollY });
            this.pinRenderer.setActiveComment(commentId);
            this.sidebar.setActiveComment(commentId);
          }
        }
        this._dragWasPopoverOpen = false;
      },
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

    // Bottom sheet (mobile popover alternative)
    this.sheet = new BottomSheet(this.container.shadowContent, {
      onReply: (commentId, text) => this.handleAddReply(commentId, text),
      onResolve: (commentId) => this.handleResolveComment(commentId),
      onReopen: (commentId) => this.handleReopenComment(commentId),
      onDelete: (commentId) => this.handleDeleteComment(commentId),
      onMarkUnread: (commentId) => this.markUnread(commentId),
      onEditComment: (commentId, text) => this.editComment(commentId, text),
      onEditReply: (commentId, replyId, text) => this.editReply(commentId, replyId, text),
      onDeleteReply: (commentId, replyId) => this.deleteReply(commentId, replyId),
      onSaveNewComment: (text) => {
        if (!this.newCommentAnchor) return;
        const now = new Date().toISOString();
        const comment: Comment = {
          id: crypto.randomUUID(),
          anchor: this.newCommentAnchor,
          scope: this.newCommentScope,
          author: this.currentUser!,
          text,
          createdAt: now,
          updatedAt: now,
          resolved: false,
          unread: false,
          replies: [],
        };
        this.store.addComment(comment);
        this.refreshUI();
        this.dismissNewComment();
        this.toolbar.setVisible(true);
      },
      onClose: () => {
        this.dismissNewComment();
        this.pinRenderer.setActiveComment(null);
        this.sidebar.setActiveComment(null);
        // On mobile in review mode, reopen the sidebar list rather than just restoring the toolbar
        if (this.isMobile() && this.mode === 'review') {
          this.sidebar.show(true);
        } else {
          this.toolbar.setVisible(true);
        }
      },
    });
    this.sheet.setReadOnly(this.options.readOnly);
    if (this.currentUser) this.sheet.setUser(this.currentUser);

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
      onClose: () => this.setMode('view'),
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
    this.tracker = new AnchorTracker(this.store, this.events, this.pinRenderer, () => {
      this.refreshUI();
      this.updatePopoverPositions();
    });
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

  private isMobile(): boolean {
    const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    return (coarsePointer && window.innerWidth < 768) || window.innerWidth < 480;
  }

  private showViewer(comment: Comment, pos: { x: number; y: number }): void {
    if (this.isMobile()) {
      this.popover.hide();
      this.sidebar.hide();
      this.sheet.show(comment, pos);
      this.toolbar.setVisible(false);
    } else {
      this.sheet.hide();
      this.popover.show(comment, pos);
    }
  }

  private hideViewer(): void {
    this.popover.hide();
    this.sheet.hide();
  }

  private isViewerVisible(): boolean {
    return this.popover.isVisible() || this.sheet.isVisible();
  }

  private getViewerCommentId(): string | null {
    return this.popover.getCurrentCommentId() ?? this.sheet.getCurrentCommentId();
  }

  destroy(): void {
    this.keyboard.detach();
    this.tracker.stop();
    this.pinRenderer.destroy();
    this.events.removeAll();
    destroyContainer(this.container);
    this.adapterCleanups.forEach(fn => fn());
  }

  toggle(): void {
    this.hidden = !this.hidden;
    this.container.root.style.display = this.hidden ? 'none' : '';
  }

  setUser(user: { name: string }): void {
    this.currentUser = user.name;
    this.popover.setUser(user.name);
    this.sheet.setUser(user.name);
  }

  on<E extends PindropEvent>(event: E, callback: (payload: PindropEventMap[E]) => void): () => void {
    return this.events.on(event, callback);
  }

  off<E extends PindropEvent>(event: E, callback: (payload: PindropEventMap[E]) => void): void {
    this.events.off(event, callback);
  }

  addComment(options: (
    | { selector: string; x?: never; y?: never }
    | { selector?: never; x: number; y: number }
  ) & { text: string; author?: string; meta?: CommentMeta }): Comment | null {
    let anchor: ReturnType<typeof createAnchor>;

    let scopeEl: Element | null = null;

    if (options.selector) {
      const el = document.querySelector(options.selector);
      if (!el) {
        console.warn(`Pindrop: Could not find element matching "${options.selector}" for programmatic comment.`);
        return null;
      }
      const rect = el.getBoundingClientRect();
      const pageX = rect.left + rect.width / 2 + window.scrollX;
      const pageY = rect.top + rect.height / 2 + window.scrollY;
      anchor = createAnchor(el, pageX, pageY);
      scopeEl = el;
    } else {
      const vx = (options as { x: number; y: number }).x;
      const vy = (options as { x: number; y: number }).y;
      const clientX = vx * window.innerWidth;
      const clientY = vy * window.innerHeight;
      const el = document.elementFromPoint(clientX, clientY);
      const pageX = clientX + window.scrollX;
      const pageY = clientY + window.scrollY;
      if (el && this.isContentElement(el)) {
        anchor = createAnchor(el, pageX, pageY);
        scopeEl = el;
      } else {
        // No element hit — store as viewport-only anchor
        anchor = { selector: '', offsetX: vx, offsetY: vy, viewportX: vx, viewportY: vy };
      }
    }

    const now = new Date().toISOString();
    const comment: Comment = {
      id: crypto.randomUUID(),
      anchor,
      scope: scopeEl ? this.options.getScope?.(scopeEl) : undefined,
      author: options.author || this.currentUser || 'Automated Agent',
      text: options.text,
      createdAt: now,
      updatedAt: now,
      resolved: false,
      unread: false,
      replies: [],
      ...(options.meta ? { meta: options.meta } : {}),
    };

    this.store.addComment(comment);
    this.refreshUI();
    return comment;
  }

  addReply(options: { commentId: string; text: string; author?: string }): Reply | null {
    const parent = this.store.getComment(options.commentId);
    if (!parent) {
      console.warn(`Pindrop: Could not find comment with ID "${options.commentId}" to append programmatic reply.`);
      return null;
    }

    const now = new Date().toISOString();
    const reply: Reply = {
      id: crypto.randomUUID(),
      author: options.author || this.currentUser || 'Automated Agent',
      text: options.text,
      createdAt: now,
      updatedAt: now,
    };
    this.store.addReply(options.commentId, reply);
    this.sidebar.update(this.getVisibleComments());

    if (this.getViewerCommentId() === options.commentId) {
      const pos = resolveAnchorPosition(parent.anchor);
      this.showViewer(parent, { x: pos.x - window.scrollX, y: pos.y - window.scrollY });
    }
    return reply;
  }

  getComments(): Comment[] {
    return this.store.getComments();
  }

  getCommentableElements(): CommentableElement[] {
    const SEMANTIC_SELECTORS = [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'main', 'header', 'footer', 'nav', 'aside',
      'section', 'article',
      'form', 'table', 'figure',
      'button', 'a[href]', 'img[alt]',
      '[data-testid]', '[data-pindrop-id]', '[id]',
    ].join(',');

    const seen = new Set<Element>();
    const results: CommentableElement[] = [];

    document.querySelectorAll(SEMANTIC_SELECTORS).forEach((el) => {
      if (!isElementVisible(el)) return;
      if (this.container.root.contains(el)) return;
      // Skip if an ancestor is already included — prefer the most specific
      for (const ancestor of seen) {
        if (ancestor.contains(el)) {
          seen.delete(ancestor);
          const idx = results.findIndex(r => r.selector === generateSelector(ancestor));
          if (idx !== -1) results.splice(idx, 1);
          break;
        }
        if (el.contains(ancestor)) return;
      }
      seen.add(el);

      const rect = el.getBoundingClientRect();
      const label =
        el.getAttribute('aria-label') ||
        el.getAttribute('alt') ||
        el.getAttribute('data-testid') ||
        el.getAttribute('id') ||
        (el.textContent?.trim().slice(0, 60) ?? '') ||
        el.tagName.toLowerCase();

      results.push({
        selector: generateSelector(el),
        label: label.trim(),
        rect: {
          x: rect.left + window.scrollX,
          y: rect.top + window.scrollY,
          width: rect.width,
          height: rect.height,
        },
      });
    });

    return results;
  }

  applyRemoteComments(incoming: Comment[]): void {
    const { comments } = mergeComments(this.store.getComments(), incoming);
    this.store.replaceAll(comments);
    this.refreshUI();
  }

  setComments(comments: Comment[]): void {
    this.store.replaceAll(comments);
    this.refreshUI();
  }

  refresh(): void {
    this.refreshUI();
    this.updatePopoverPositions();
  }

  private getVisibleComments(): Comment[] {
    return filterVisibleComments(this.store.getComments(), this.options);
  }

  private isCommentVisible(comment: Comment): boolean {
    return getCommentVisibility(comment, this.options).visible;
  }

  resolveComment(commentId: string, author?: string): Comment | null {
    const comment = this.store.getComment(commentId);
    if (!comment) return null;
    this.store.resolveComment(commentId, author || this.currentUser || 'Automated Agent');
    this.refreshUI();
    return this.store.getComment(commentId) ?? null;
  }

  reopenComment(commentId: string): void {
    if (!this.store.getComment(commentId)) return;
    this.store.reopenComment(commentId);
    this.refreshUI();
    
    if (this.getViewerCommentId() === commentId) {
      const comment = this.store.getComment(commentId)!;
      if (this.isCommentVisible(comment)) {
        const pos = resolveAnchorPosition(comment.anchor);
        this.showViewer(comment, { x: pos.x - window.scrollX, y: pos.y - window.scrollY });
        this.pinRenderer.setActiveComment(commentId);
      } else {
        this.hideViewer();
        this.pinRenderer.setActiveComment(null);
        this.sidebar.setActiveComment(null);
      }
    }
  }

  deleteComment(commentId: string): void {
    if (!this.store.getComment(commentId)) return;
    this.store.deleteComment(commentId);
    if (this.getViewerCommentId() === commentId) {
      this.hideViewer();
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
      const mobile = this.isMobile();
      this.sidebar.show(mobile);
      if (mobile) this.toolbar.setVisible(false);
    } else {
      this.sidebar.hide();
    }

    this.toolbar.setMode(mode);
    this.pinRenderer.setMode(mode);
    this.events.emit('mode:change', { mode });

    // Re-render pins when entering comment mode so positions are recomputed
    // after any slide transition that may have been in progress when the last
    // slidechanged event fired.
    if (mode === 'comment') {
      this.refreshUI();
    }

    // Clean up when leaving comment mode
    if (prev === 'comment' && mode !== 'comment') {
      this.clearHighlight();
      this.hideViewer();
      this.dismissNewComment();
      this.toolbar.setVisible(true);
    }
    // Close popover when entering view (no pins visible)
    if (mode === 'view') {
      this.hideViewer();
      this.pinRenderer.setActiveComment(null);
      this.sidebar.setActiveComment(null);
      this.toolbar.setVisible(true);
    }
  }

  private isContentElement(el: Element | null): boolean {
    return !!el && el !== document.body && el !== document.documentElement
      && el !== this.container.root && el !== this.container.overlay
      && !this.container.pinContainer.contains(el);
  }

  private onOverlayHover(e: MouseEvent): void {
    if (this.mode !== 'comment') return;
    if (this.pinRenderer.isTooltipVisible()) { this.clearHighlight(); this.container.overlay.style.cursor = 'default'; return; }

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
    if (this.pinRenderer.isTooltipVisible()) return;
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
      this.sheet.setUser(this.currentUser);
    }

    const pageX = e.clientX + window.scrollX;
    const pageY = e.clientY + window.scrollY;
    const anchor = createAnchor(target as Element, pageX, pageY);

    // Show comment input popover
    this.showNewCommentPopover(anchor, target as Element, { x: e.clientX, y: e.clientY });
  }

  private showNewCommentPopover(anchor: ReturnType<typeof createAnchor>, target: Element, position: { x: number; y: number }): void {
    this.hideViewer();
    this.dismissNewComment();

    if (this.isMobile()) {
      this.showMobileNewCommentSheet(anchor, target, position);
      return;
    }

    // Hide the overlay so it can't intercept clicks on the comment box
    this.container.overlay.style.display = 'none';

    // Safari rendering bug: WebKit won't update the cursor after `display: none` until the mouse moves.
    // Hack: Force a global cursor repaint, then remove it on the next frame.
    const safariHack = document.createElement('style');
    safariHack.textContent = '*, *::before, *::after { cursor: default !important; }';
    document.head.appendChild(safariHack);
    requestAnimationFrame(() => safariHack.remove());

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
    pin.innerHTML = pinSvgHtml(PIN_COLOR, this.getVisibleComments().length + 1);

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
        scope: this.newCommentScope,
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
    this.newCommentScope = this.options.getScope?.(target);
    textarea.focus();
  }

  private dismissNewComment(): void {
    if (this.newCommentEl) {
      this.newCommentEl.remove();
      this.newCommentEl = null;
    }
    
    if (this.newCommentAnchor) {
      if (this.isMobile()) {
        this.sheet.hide();
      }
      this.newCommentAnchor = null;
      this.newCommentScope = undefined;
    }

    if (this.isMobile()) {
      if (!this.container.shadowContent.querySelector('.pindrop-sheet, .pindrop-sidebar-sheet')) {
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      }
    }

    // Restore the shadow host to 0x0
    this.container.root.style.position = '';
    this.container.root.style.inset = '';
    this.container.root.style.width = '0';
    this.container.root.style.height = '0';
    this.container.root.style.pointerEvents = '';

    // Restore the overlay if still in comment mode
    if (this.mode === 'comment') {
      this.container.overlay.style.display = '';
    }
  }

  private showMobileNewCommentSheet(anchor: ReturnType<typeof createAnchor>, target: Element, position: { x: number; y: number }): void {
    this.container.overlay.style.display = 'none';
    
    // Expand shadow host to allow pin rendering, but don't force 100vh manually 
    // if the sheet handles its own positioning. However, since the pin is at a 
    // specific position, we need the host to be large enough. 
    // Using inset: 0 on the host is safer than 100vw/vh if we want to avoid 
    // distortion, but for now we'll just ensure it covers the viewport 
    // without the zero-sized wrapper.
    this.container.root.style.position = 'fixed';
    this.container.root.style.inset = '0';
    this.container.root.style.width = '100vw';
    this.container.root.style.height = '100vh';
    this.container.root.style.pointerEvents = 'none';

    // Pin at tap position (direct child of shadowContent)
    const pin = document.createElement('div');
    pin.className = 'pindrop-new-pin';
    pin.style.left = `${position.x}px`;
    pin.style.top = `${position.y}px`;
    pin.innerHTML = pinSvgHtml(PIN_COLOR, this.getVisibleComments().length + 1);

    this.container.shadowContent.appendChild(pin);
    this.newCommentEl = pin; // Track the pin for cleanup
    this.newCommentAnchor = anchor;
    this.newCommentScope = this.options.getScope?.(target);

    this.sheet.showNewComment({ x: position.x, y: position.y });
    this.toolbar.setVisible(false);
  }

  private onPinClick(commentId: string): void {
    // Toggle: clicking the same pin again closes the viewer
    if (this.getViewerCommentId() === commentId) {
      this.hideViewer();
      this.pinRenderer.setActiveComment(null);
      this.sidebar.setActiveComment(null);
      return;
    }

    const comment = this.store.getComment(commentId);
    if (!comment) return;
    if (!this.isCommentVisible(comment)) {
      this.refreshUI();
      return;
    }

    // Dismiss any in-progress new comment
    this.dismissNewComment();
    this.clearHighlight();

    // Mark as read when opening
    if (comment.unread) {
      this.store.markRead(commentId);
      this.pinRenderer.renderAll(this.getVisibleComments());
      this.sidebar.update(this.getVisibleComments());
    }

    const pos = resolveAnchorPosition(comment.anchor);
    if (this.isMobile()) {
      window.scrollTo({ top: Math.max(0, pos.y - window.innerHeight / 3), behavior: 'smooth' });
    }
    this.showViewer(comment, { x: pos.x - window.scrollX, y: pos.y - window.scrollY });
    this.pinRenderer.setActiveComment(commentId);
    this.sidebar.setActiveComment(commentId);
  }

  private onSidebarCommentClick(commentId: string): void {
    const comment = this.store.getComment(commentId);
    if (!comment) return;
    if (!this.isCommentVisible(comment)) {
      this.refreshUI();
      return;
    }

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
      this.sheet.setUser(this.currentUser);
    }

    const now = new Date().toISOString();
    this.store.addReply(commentId, {
      id: crypto.randomUUID(),
      author: this.currentUser,
      text,
      createdAt: now,
      updatedAt: now,
    });

    // Re-show viewer with updated data
    const comment = this.store.getComment(commentId);
    if (comment) {
      const pos = resolveAnchorPosition(comment.anchor);
      this.showViewer(comment, { x: pos.x - window.scrollX, y: pos.y - window.scrollY });
    }
    this.sidebar.update(this.getVisibleComments());
  }

  private async handleResolveComment(commentId: string): Promise<void> {
    if (!this.currentUser) {
      this.currentUser = await this.namePrompt.prompt(this.options.storageKey);
      if (!this.currentUser) return;
      this.popover.setUser(this.currentUser);
      this.sheet.setUser(this.currentUser);
    }
    this.store.resolveComment(commentId, this.currentUser);
    this.refreshUI();
  }

  private handleReopenComment(commentId: string): void {
    this.store.reopenComment(commentId);
    this.refreshUI();

    // Re-show viewer with updated state
    const comment = this.store.getComment(commentId);
    if (comment) {
      const pos = resolveAnchorPosition(comment.anchor);
      this.showViewer(comment, { x: pos.x - window.scrollX, y: pos.y - window.scrollY });
      this.pinRenderer.setActiveComment(commentId);
    }
  }

  private handleDeleteComment(commentId: string): void {
    this.store.deleteComment(commentId);
    this.hideViewer();
    this.refreshUI();
  }

  private editComment(commentId: string, text: string): void {
    this.store.editComment(commentId, text);
    this.sidebar.update(this.getVisibleComments());
  }

  private editReply(commentId: string, replyId: string, text: string): void {
    this.store.editReply(commentId, replyId, text);
  }

  private deleteReply(commentId: string, replyId: string): void {
    this.store.deleteReply(commentId, replyId);
    // Re-show viewer with updated data
    const comment = this.store.getComment(commentId);
    if (comment) {
      const pos = resolveAnchorPosition(comment.anchor);
      this.showViewer(comment, { x: pos.x - window.scrollX, y: pos.y - window.scrollY });
      this.pinRenderer.setActiveComment(commentId);
    }
  }

  private markUnread(commentId: string): void {
    this.store.markUnread(commentId);
    this.refreshUI();
  }

  private navigatePin(direction: number): void {
    const comments = this.getVisibleComments();
    if (comments.length === 0) return;

    this.currentPinIndex += direction;
    if (this.currentPinIndex < 0) this.currentPinIndex = comments.length - 1;
    if (this.currentPinIndex >= comments.length) this.currentPinIndex = 0;

    this.onSidebarCommentClick(comments[this.currentPinIndex].id);
  }

  private onEscape(): void {
    if (this.isViewerVisible()) {
      this.hideViewer();
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
    this.sheet.setUser(name);
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
    this.hideViewer();
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
    this.pinRenderer?.renderAll(this.getVisibleComments());
  }

  private refreshUI(): void {
    const comments = this.getVisibleComments();
    this.pinRenderer.renderAll(comments);
    this.container.pinContainer.style.visibility = '';
    this.sidebar.update(comments);
    this.toolbar.setCommentCount(comments.length);

    const activeCommentId = this.getViewerCommentId();
    if (activeCommentId) {
      const activeComment = this.store.getComment(activeCommentId);
      if (!activeComment || !this.isCommentVisible(activeComment)) {
        this.hideViewer();
        this.pinRenderer.setActiveComment(null);
        this.sidebar.setActiveComment(null);
      }
    }
  }

  private updatePopoverPositions(): void {
    // Existing comment viewer
    const commentId = this.getViewerCommentId();
    if (commentId) {
      const comment = this.store.getComment(commentId);
      if (comment && this.isCommentVisible(comment)) {
        if (!this.isMobile()) {
          const pos = resolveAnchorPosition(comment.anchor);
          this.popover.updatePosition({ x: pos.x - window.scrollX, y: pos.y - window.scrollY });
        }
      } else {
        this.hideViewer();
        this.pinRenderer.setActiveComment(null);
        this.sidebar.setActiveComment(null);
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

export type { PindropOptions, PindropMode, Comment, CommentMeta, CommentableElement, CommentScope, ImportResult, PindropEvent, PindropEventMap };
