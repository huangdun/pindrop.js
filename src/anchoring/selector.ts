function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && CSS.escape) {
    return CSS.escape(value);
  }
  // Simple fallback for environments without CSS.escape (e.g. jsdom)
  return value.replace(/([^\w-])/g, '\\$1');
}

export function generateSelector(el: Element): string {
  return buildStructuralPath(el);
}

function buildStructuralPath(el: Element): string {
  const parts: string[] = [];
  let current: Element | null = el;

  while (current && current !== document.documentElement) {
    if (current === document.body) {
      parts.unshift('body');
      break;
    }

    if (current.id) {
      const escaped = cssEscape(current.id);
      if (document.querySelectorAll(`#${escaped}`).length === 1) {
        parts.unshift(`#${escaped}`);
        break;
      }
      // Duplicate id — don't trust it, fall through to structural path
    }

    const pindropId = current.getAttribute('data-pindrop-id');
    if (pindropId) {
      const sel = `[data-pindrop-id="${cssEscape(pindropId)}"]`;
      if (document.querySelectorAll(sel).length === 1) {
        parts.unshift(sel);
        break;
      }
    }

    const testId = current.getAttribute('data-testid');
    if (testId) {
      const sel = `[data-testid="${cssEscape(testId)}"]`;
      if (document.querySelectorAll(sel).length === 1) {
        parts.unshift(sel);
        break;
      }
    }

    const dataId = current.getAttribute('data-id');
    if (dataId) {
      const sel = `[data-id="${cssEscape(dataId)}"]`;
      if (document.querySelectorAll(sel).length === 1) {
        parts.unshift(sel);
        break;
      }
    }

    let part = current.tagName.toLowerCase();

    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (s) => s.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        part += `:nth-of-type(${index})`;
      }
    }

    parts.unshift(part);
    current = current.parentElement;
  }

  return parts.join(' > ');
}