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
      parts.unshift(`#${cssEscape(current.id)}`);
      break;
    }

    const pindropId = current.getAttribute('data-pindrop-id');
    if (pindropId) {
      parts.unshift(`[data-pindrop-id="${cssEscape(pindropId)}"]`);
      break;
    }

    const testId = current.getAttribute('data-testid');
    if (testId) {
      parts.unshift(`[data-testid="${cssEscape(testId)}"]`);
      break;
    }

    const dataId = current.getAttribute('data-id');
    if (dataId) {
      parts.unshift(`[data-id="${cssEscape(dataId)}"]`);
      break;
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