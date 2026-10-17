const keys = new Map<string, string>();

/** Keep token identity in inline styles, even when two tokens have the same hex. */
export function previewVar(key: string) {
  const variable = `--preview-${key.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  keys.set(variable, key);
  return { variable, value: `var(${variable})` };
}

export interface PickedColor {
  part: "Text" | "Border" | "Fill";
  key: string;
}

export function inspectPreview(target: Element, root: HTMLElement, x: number, y: number): PickedColor[] {
  const found = new Map<PickedColor["part"], PickedColor>();
  let onBorder = false;
  let onGlyph = target instanceof SVGElement;
  // Text ranges distinguish a glyph's rectangle from padding around its element.
  const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    if (!walker.currentNode.textContent?.trim()) continue;
    const range = document.createRange();
    range.selectNodeContents(walker.currentNode);
    if ([...range.getClientRects()].some((r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom)) {
      onGlyph = true;
      break;
    }
  }
  for (let element: Element | null = target; element && root.contains(element); element = element.parentElement) {
    if (!(element instanceof HTMLElement || element instanceof SVGElement)) continue;
    const style = element.style;
    const box = element.getBoundingClientRect();
    const properties: [PickedColor["part"], string][] = [
      ["Text", "color"], ["Fill", "background"], ["Fill", "background-color"],
      ["Border", "border"], ["Border", "border-top"], ["Border", "border-right"],
      ["Border", "border-bottom"], ["Border", "border-left"], ["Border", "text-decoration-color"],
    ];
    for (const [part, property] of properties) {
      const match = /var\((--preview-[\w-]+)\)/.exec(style.getPropertyValue(property));
      const key = match && keys.get(match[1]);
      if (!key || found.has(part)) continue;
      found.set(part, { part, key });
      if (part === "Border") {
        const edge = property.replace("border-", "");
        const distances: Record<string, number> = { top: y - box.top, right: box.right - x, bottom: box.bottom - y, left: x - box.left };
        onBorder = property === "border" ? Math.min(...Object.values(distances)) < 4 : (distances[edge] ?? Infinity) < 4;
      }
    }
    if (element === root) break;
  }
  const preferred = onGlyph ? "Text" : onBorder ? "Border" : "Fill";
  return [...found.values()].sort((a, b) => Number(b.part === preferred) - Number(a.part === preferred));
}
