/**
 * Design tokens — single source of truth for values used outside the Shadow DOM
 * (pins, overlay cursor, highlight). Shadow DOM components use CSS variables
 * defined in styles.css which mirror these values.
 */

export const PIN_COLOR = '#0d99ff';
export const PIN_READ = '#ffffff'; // fallback, use getReadPinColor() for theme-aware value
export const WHITE = '#fff';

export const FONT_FAMILY = "'Inter', system-ui, -apple-system, sans-serif";

// drop-shadow for SVG pins (filter syntax, follows SVG shape outline)
export const DROP_SHADOW_PIN =
  'drop-shadow(0 1px 3px rgba(0,0,0,0.12)) drop-shadow(0 3px 8px rgba(0,0,0,0.08))';

export const PIN_SIZE = 36;

// Lucide message-circle path (24x24 viewBox) — the pin shape
export const PIN_BUBBLE_PATH =
  'M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719';

// Tail tip at ~(2, 21) in 24-unit viewBox → scaled to PIN_SIZE
export const PIN_TAIL_OFFSET_X = Math.round(2 / 24 * PIN_SIZE);   // 3
export const PIN_TAIL_OFFSET_Y = Math.round(21 / 24 * PIN_SIZE);  // 32

/** Curated avatar palette — distinct, accessible on white text. */
const AVATAR_COLORS = [
  '#0d99ff', '#e53935', '#7b61ff', '#f57c00',
  '#00b0a0', '#d81b60', '#5c6bc0', '#43a047',
  '#8d6e63', '#00838f',
];

/** Deterministic color for a username. */
export function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/** Comment-mode cursor (Lucide message-circle-plus, hotspot at bottom-left tail). */
export const COMMENT_CURSOR = (() => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="${PIN_COLOR}" stroke="${PIN_COLOR}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${PIN_BUBBLE_PATH}"/><path d="M8 12h8" stroke="${WHITE}" fill="none"/><path d="M12 8v8" stroke="${WHITE}" fill="none"/></svg>`;
  const b64 = typeof btoa === 'function' ? btoa(svg) : svg;
  return `url("data:image/svg+xml;base64,${b64}") 2 22, crosshair`;
})();

/** Bot icon SVG (inline, 12x12) for agent badge. */
export const ICON_AGENT = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>`;

/** Generate inline SVG for a pin with a number inside the bubble.
 *  Circle center is at (12, 11) in the 24x24 viewBox. */
export function pinSvgHtml(color: string, number: number | string, textColor: string = WHITE): string {
  return `<svg width="${PIN_SIZE}" height="${PIN_SIZE}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="${PIN_BUBBLE_PATH}" fill="${color}"/><text x="12" y="12" text-anchor="middle" dominant-baseline="central" fill="${textColor}" font-size="10" font-weight="600" font-family="${FONT_FAMILY}">${number}</text></svg>`;
}