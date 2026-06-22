type TouchReorderDropIndexOptions = {
  x: number;
  y: number;
  itemSelector: string;
  rootSelector: string;
  itemCount: number;
};

function closestElementFromPoint(x: number, y: number, selector: string) {
  const element = document.elementFromPoint(x, y);
  return element instanceof Element ? element.closest<HTMLElement>(selector) : null;
}

function readReorderIndex(element: HTMLElement | null) {
  if (!element) return null;
  const value = Number(element.dataset.touchReorderIndex);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

export function getTouchReorderDropIndex({
  x,
  y,
  itemSelector,
  rootSelector,
  itemCount,
}: TouchReorderDropIndexOptions): number | null {
  const item = closestElementFromPoint(x, y, itemSelector);
  const itemIndex = readReorderIndex(item);
  if (item && itemIndex !== null) {
    const rect = item.getBoundingClientRect();
    return y < rect.top + rect.height / 2 ? itemIndex : itemIndex + 1;
  }

  const root = closestElementFromPoint(x, y, rootSelector);
  if (!root) return null;

  const items = Array.from(root.querySelectorAll<HTMLElement>(itemSelector));
  for (const [index, candidate] of items.entries()) {
    const rect = candidate.getBoundingClientRect();
    if (y < rect.top) return index;
    if (y <= rect.bottom) return y < rect.top + rect.height / 2 ? index : index + 1;
  }

  return itemCount;
}
