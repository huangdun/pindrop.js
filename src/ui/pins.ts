import type { PindropMode, Comment } from '../core/types';
import type { Store } from '../core/store';
import { resolveAnchorPosition } from '../anchoring/position';
import { PIN_COLOR, PIN_READ, DROP_SHADOW_PIN, PIN_SIZE, PIN_TAIL_OFFSET_X, PIN_TAIL_OFFSET_Y, FONT_FAMILY, pinSvgHtml, avatarColor } from '../styles/tokens';

export class PinRenderer {
  private pins = new Map<string, HTMLDivElement>();
  private tooltip: HTMLDivElement | null = null;
  private shadowHost: HTMLElement | null = null;
  private activeCommentId: string | null = null;
  private mode: PindropMode = 'view';

  constructor(
    private container: HTMLDivElement,
    private store: Store,
    private options: { zIndex: number; onPinClick: (commentId: string) => void }
  ) { }

  setShadowHost(host: HTMLElement): void {
    this.shadowHost = host;
  }

  setActiveComment(commentId: string | null): void {
    this.activeCommentId = commentId;
    if (this.mode === 'review') this.updatePinVisibility();
  }

  setMode(mode: PindropMode): void {
    this.mode = mode;
    this.updatePinVisibility();
  }

  private updatePinVisibility(): void {
    for (const [id, pin] of this.pins) {
      if (this.mode === 'review') {
        pin.style.display = id === this.activeCommentId ? '' : 'none';
      } else {
        pin.style.display = '';
      }
    }
  }

  private getReadColor(): string {
    if (this.shadowHost) {
      return getComputedStyle(this.shadowHost).getPropertyValue('--pindrop-bg').trim() || PIN_READ;
    }
    return PIN_READ;
  }

  renderAll(): void {
    this.clear();
    const comments = this.store.getComments();
    comments.forEach((comment, index) => {
      this.renderPin(comment, index + 1);
    });
  }

  renderPin(comment: Comment, number: number): void {
    const pos = resolveAnchorPosition(comment.anchor);
    const pin = document.createElement('div');

    const readColor = this.getReadColor();
    const color = comment.resolved ? readColor : comment.unread ? PIN_COLOR : readColor;
    const textColor = color === PIN_COLOR ? '#ffffff' : this.getThemeStyles().text;
    pin.style.cssText = `
      position:absolute !important;
      left:${pos.x}px !important;
      top:${pos.y}px !important;
      width:${PIN_SIZE}px !important;
      height:${PIN_SIZE}px !important;
      cursor:pointer !important;
      pointer-events:auto !important;
      transform:translate(-${PIN_TAIL_OFFSET_X}px,-${PIN_TAIL_OFFSET_Y}px) !important;
      filter:${DROP_SHADOW_PIN} !important;
      user-select:none !important;
      z-index:${this.options.zIndex} !important;
      opacity:${comment.resolved ? '0.4' : '1'} !important;
    `;
    pin.innerHTML = pinSvgHtml(color, number, textColor);
    pin.dataset.commentId = comment.id;

    pin.addEventListener('mouseenter', () => {
      if (this.activeCommentId !== comment.id) {
        this.showTooltip(comment, pin);
      }
    });
    pin.addEventListener('mouseleave', () => {
      this.hideTooltip();
    });
    pin.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hideTooltip();
      this.options.onPinClick(comment.id);
    });

    this.container.appendChild(pin);
    this.pins.set(comment.id, pin);
  }

  updatePositions(): void {
    const comments = this.store.getComments();
    comments.forEach((comment) => {
      const pin = this.pins.get(comment.id);
      if (!pin) return;
      const pos = resolveAnchorPosition(comment.anchor);
      pin.style.setProperty('left', `${pos.x}px`, 'important');
      pin.style.setProperty('top', `${pos.y}px`, 'important');
    });
  }

  private getThemeStyles(): { bg: string; text: string; textSecondary: string; shadow: string; radius: string } {
    if (this.shadowHost) {
      const s = getComputedStyle(this.shadowHost);
      return {
        bg: s.getPropertyValue('--pindrop-bg').trim() || '#ffffff',
        text: s.getPropertyValue('--pindrop-text').trim() || 'rgba(0,0,0,0.9)',
        textSecondary: s.getPropertyValue('--pindrop-text-secondary').trim() || 'rgba(0,0,0,0.5)',
        shadow: s.getPropertyValue('--pindrop-shadow').trim() || '0 0 0.5px rgba(0,0,0,0.12), 0 10px 16px rgba(0,0,0,0.12), 0 2px 5px rgba(0,0,0,0.15)',
        radius: s.getPropertyValue('--pindrop-radius').trim() || '13px',
      };
    }
    return { bg: '#ffffff', text: 'rgba(0,0,0,0.9)', textSecondary: 'rgba(0,0,0,0.5)', shadow: '0 0 0.5px rgba(0,0,0,0.12), 0 10px 16px rgba(0,0,0,0.12), 0 2px 5px rgba(0,0,0,0.15)', radius: '13px' };
  }

  private showTooltip(comment: Comment, pinEl: HTMLDivElement): void {
    this.hideTooltip();

    const theme = this.getThemeStyles();
    const tip = document.createElement('div');
    const text = comment.text.length > 80 ? comment.text.slice(0, 80) + '...' : comment.text;
    const replyCount = comment.replies.length;
    const replyLabel = replyCount > 0 ? `<div style="color:${theme.textSecondary};font-size:11px;margin-top:2px;">${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}</div>` : '';

    const initial = comment.author.charAt(0).toUpperCase();
    const aColor = avatarColor(comment.author);
    tip.innerHTML = `<div style="display:flex;align-items:flex-start;gap:10px;"><div style="flex-shrink:0;width:24px;height:24px;border-radius:9999px;background:${aColor};color:#fff;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center;margin-top:-1px;">${initial}</div><div style="min-width:0;"><strong style="font-weight:550;font-size:13px;line-height:22px;">${this.escapeHtml(comment.author)}</strong><div style="color:${theme.textSecondary};margin-top:2px;line-height:22px;">${this.escapeHtml(text)}</div>${replyLabel}</div></div>`;
    tip.style.cssText = `
      position:fixed !important;
      box-sizing:border-box !important;
      background:${theme.bg} !important;
      border-radius:${theme.radius} !important;
      padding:12px !important;
      font-size:13px !important;
      font-family:${FONT_FAMILY} !important;
      color:${theme.text} !important;
      line-height:1.4 !important;
      width:280px !important;
      pointer-events:none !important;
      box-shadow:${theme.shadow} !important;
      z-index:${this.options.zIndex + 1} !important;
      white-space:normal !important;
      word-break:break-word !important;
    `;

    // Position right of pin bubble, or left if no space (same as popover/input box)
    const rect = pinEl.getBoundingClientRect();
    const tailX = rect.left + PIN_TAIL_OFFSET_X;
    const tailY = rect.top + PIN_TAIL_OFFSET_Y;
    const pinRight = tailX + 33;
    const tipWidth = 280;
    const spaceRight = window.innerWidth - pinRight;

    let left = spaceRight > tipWidth + 8
      ? pinRight + 8
      : tailX - 3 - tipWidth - 8;
    if (left < 8) left = 8;
    let top = tailY - 32;
    if (top < 8) top = 8;

    tip.style.setProperty('left', `${left}px`, 'important');
    tip.style.setProperty('top', `${top}px`, 'important');

    // Append to document.body so it's outside the shadow DOM stacking context
    document.body.appendChild(tip);
    this.tooltip = tip;
  }

  private hideTooltip(): void {
    this.tooltip?.remove();
    this.tooltip = null;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  clear(): void {
    this.hideTooltip();
    this.pins.forEach((pin) => pin.remove());
    this.pins.clear();
  }

  destroy(): void {
    this.clear();
  }
}