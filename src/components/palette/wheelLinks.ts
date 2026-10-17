import type { RelationalColor } from "../../engine/relational";

export interface WheelLink<T> {
  from: T;
  to: T;
  active: boolean;
}

export function wheelLinks<T extends RelationalColor>(
  palette: readonly T[],
  selectedId: string | null,
  crossGroup: boolean,
): WheelLink<T>[] {
  const groups = new Map<string, T[]>();
  for (const color of palette) {
    if (color.group === null) continue;
    const key = crossGroup ? "all" : color.group;
    const group = groups.get(key) ?? [];
    group.push(color);
    groups.set(key, group);
  }
  // A star per group shows every relationship without drawing a dense clique.
  // The selected color becomes its group's hub, matching what a drag will move.
  return [...groups.values()].flatMap((group) => {
    const from = group.find((c) => c.id === selectedId) ?? group[0];
    return group.filter((to) => to.id !== from.id).map((to) => ({
      from,
      to,
      active: from.id === selectedId,
    }));
  });
}
