import { composite, contrastRatio } from "../color/color";
import { SYNTAX_GROUPS } from "../data/syntax";
import type { ThemeView } from "./view";

export interface ContrastPair {
  id: string;
  label: string;
  /** Workbench key, or "syntax:<groupId>" for a token color. */
  fg: string;
  bg: string;
  /** Text the guard protects (secondary UI like line numbers is only reported). */
  guarded: boolean;
}

export const CONTRAST_PAIRS: ContrastPair[] = [
  { id: "editor", label: "Editor text", fg: "editor.foreground", bg: "editor.background", guarded: true },
  { id: "lineNumbers", label: "Line numbers", fg: "editorLineNumber.foreground", bg: "editor.background", guarded: false },
  { id: "sideBar", label: "Side bar", fg: "sideBar.foreground", bg: "sideBar.background", guarded: true },
  { id: "listSel", label: "List selection", fg: "list.activeSelectionForeground", bg: "list.activeSelectionBackground", guarded: true },
  { id: "tabActive", label: "Active tab", fg: "tab.activeForeground", bg: "tab.activeBackground", guarded: true },
  { id: "tabInactive", label: "Tabs (inactive)", fg: "tab.inactiveForeground", bg: "tab.inactiveBackground", guarded: false },
  { id: "titleBar", label: "Title bar", fg: "titleBar.activeForeground", bg: "titleBar.activeBackground", guarded: true },
  { id: "statusBar", label: "Status bar", fg: "statusBar.foreground", bg: "statusBar.background", guarded: true },
  { id: "buttons", label: "Buttons", fg: "button.foreground", bg: "button.background", guarded: true },
  { id: "inputs", label: "Inputs", fg: "input.foreground", bg: "input.background", guarded: true },
  { id: "terminal", label: "Terminal", fg: "terminal.foreground", bg: "terminal.background", guarded: true },
  { id: "notifications", label: "Notifications", fg: "notifications.foreground", bg: "notifications.background", guarded: true },
  ...SYNTAX_GROUPS.map((g) => ({
    id: `syntax:${g.id}`,
    label: g.label,
    fg: `syntax:${g.id}`,
    bg: "editor.background",
    guarded: true,
  })),
];

/** WCAG ratio for a pair; translucent colors are composited over the editor background. */
export function pairRatio(view: ThemeView, pair: ContrastPair): number | null {
  const base = view.color("editor.background") ?? "#000000";
  const bgRaw = view.color(pair.bg);
  const fg = pair.fg.startsWith("syntax:") ? view.token(pair.fg.slice(7)).color : view.color(pair.fg);
  if (!fg || !bgRaw) return null;
  return contrastRatio(fg, composite(bgRaw, base));
}

/**
 * Floors for the guarded pairs that currently meet the threshold. Pairs that
 * already fail are left alone (they are flagged in the contrast list instead),
 * so a theme with one weak color can still be dragged freely.
 */
export function guardFloors(view: ThemeView, threshold: number): Map<string, number> {
  const floors = new Map<string, number>();
  for (const p of CONTRAST_PAIRS) {
    if (!p.guarded) continue;
    const r = pairRatio(view, p);
    if (r !== null && r >= threshold) floors.set(p.id, threshold);
  }
  return floors;
}

const TOLERANCE = 0.005;

/** Labels of guarded pairs that would drop below their floor. */
export function guardViolations(view: ThemeView, floors: Map<string, number>): string[] {
  const out: string[] = [];
  for (const p of CONTRAST_PAIRS) {
    const floor = floors.get(p.id);
    if (floor === undefined) continue;
    const r = pairRatio(view, p);
    if (r !== null && r < floor - TOLERANCE) out.push(p.label);
  }
  return out;
}

/**
 * Finds the furthest point t in [0, 1] along a path that still passes `ok`,
 * assuming t = 0 passes. Used to stop a drag right at the contrast boundary.
 */
export function furthestValid(ok: (t: number) => boolean, iterations = 12): number {
  if (ok(1)) return 1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < iterations; i++) {
    const mid = (lo + hi) / 2;
    if (ok(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}
