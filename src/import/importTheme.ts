import { converter, parse } from "culori";
import { hexToLch, isHex, lchToHex, splitAlpha, type Lch } from "../color/color";
import { SYNTAX_GROUPS } from "../data/syntax";
import { KNOWN_KEYS } from "../data/workbench";
import type {
  ColorAssignment,
  ExtraTokenRule,
  FontStyle,
  PaletteColor,
  SyntaxAssignment,
  ThemeDocument,
  ThemeType,
} from "../stores/types";
import { matchToken, splitScopes, type ResolvedRule } from "../theme/tokens";

export interface ImportOptions {
  /**
   * How far apart (OKLab a/b distance) two colors may be and still share a
   * palette entry; their lightness difference becomes a derived offset.
   * 0 keeps every distinct color as its own palette entry.
   */
  tolerance: number;
  /** Keep every imported token rule (exact) instead of only the ten groups. */
  keepTokenRules: boolean;
}

export interface ImportStats {
  uniqueColors: number;
  paletteSize: number;
  /** Largest OKLab distance between an original color and its imported version. */
  maxError: number;
  workbenchKeys: number;
  tokenRules: number;
  warnings: string[];
}

export interface ImportResult {
  doc: ThemeDocument;
  stats: ImportStats;
}

const toLab = converter("oklab");
/** Colors further apart than this in lightness never merge, whatever the tolerance. */
const MAX_MERGE_DL = 0.12;

interface Cluster {
  id: string;
  rep: string;
  lch: Lch;
  a: number;
  b: number;
  role?: Role;
}

type Role = "bg" | "fg" | "bgAlt" | "bgHighlight" | "selection" | "border" | "fgMuted" | "accent";

const ROLE_NAMES: Record<Role, string> = {
  bg: "Background",
  fg: "Foreground",
  bgAlt: "Background Alt",
  bgHighlight: "Highlight",
  selection: "Selection",
  border: "Border",
  fgMuted: "Muted Text",
  accent: "Accent",
};

/** Keys that identify a role, in priority order. "token:" probes a token scope. */
const ROLE_SOURCES: [Role, string[]][] = [
  ["bg", ["editor.background"]],
  ["fg", ["editor.foreground", "foreground"]],
  ["bgAlt", ["sideBar.background", "activityBar.background", "panel.background"]],
  ["bgHighlight", ["editor.lineHighlightBackground", "list.hoverBackground"]],
  ["selection", ["editor.selectionBackground", "list.activeSelectionBackground"]],
  ["border", ["sideBar.border", "panel.border", "editorGroup.border", "tab.border"]],
  ["fgMuted", ["editorLineNumber.foreground", "token:comment.line.double-slash.js"]],
  ["accent", ["focusBorder", "button.background", "statusBar.background", "activityBarBadge.background"]],
];

const NEUTRAL_ROLES = new Set<Role>(["bg", "fg", "bgAlt", "bgHighlight", "selection", "border", "fgMuted"]);

function hueName({ l, c, h }: Lch): string {
  if (c < 0.03) return l < 0.35 ? "Dark Gray" : l > 0.75 ? "Light Gray" : "Gray";
  const bins: [number, string][] = [
    [15, "Pink"], [45, "Red"], [70, "Orange"], [110, "Yellow"], [165, "Green"],
    [215, "Cyan"], [275, "Blue"], [320, "Purple"], [350, "Magenta"], [361, "Pink"],
  ];
  return bins.find(([max]) => h < max)![1];
}

function labOf(hex: string) {
  const lab = toLab(parse(hex)!);
  return { l: lab.l, a: lab.a, b: lab.b };
}

function labDistance(x: string, y: string): number {
  const p = labOf(x);
  const q = labOf(y);
  return Math.hypot(p.l - q.l, p.a - q.a, p.b - q.b);
}

const round = (v: number, digits = 3) => Math.round(v * 10 ** digits) / 10 ** digits;

/** Converts a VS Code color theme (already parsed) into an editable document. */
export function importVSCodeTheme(json: unknown, options: ImportOptions, fallbackName = "Imported theme"): ImportResult {
  if (!json || typeof json !== "object") throw new Error("That doesn't look like a theme file (expected a JSON object).");
  const theme = json as Record<string, unknown>;
  const warnings: string[] = [];

  // ---- collect workbench colors
  const rawColors = (theme.colors && typeof theme.colors === "object" ? theme.colors : {}) as Record<string, unknown>;
  const colors: Record<string, string> = {};
  let invalid = 0;
  for (const [key, value] of Object.entries(rawColors)) {
    if (typeof value === "string" && isHex(value)) colors[key] = value.toLowerCase();
    else if (value !== null && value !== undefined) invalid++;
  }
  if (invalid) warnings.push(`${invalid} color value${invalid === 1 ? "" : "s"} that aren't hex colors were skipped.`);

  // ---- collect token rules
  interface RawRule { name?: string; scope: string[]; foreground?: string; fontStyle?: string }
  const rules: RawRule[] = [];
  if (typeof theme.tokenColors === "string") {
    warnings.push("tokenColors points to another file; only inline token colors can be imported.");
  } else if (Array.isArray(theme.tokenColors)) {
    for (const r of theme.tokenColors as Record<string, unknown>[]) {
      const settings = (r?.settings ?? {}) as Record<string, unknown>;
      const fg = typeof settings.foreground === "string" && isHex(settings.foreground) ? settings.foreground.toLowerCase() : undefined;
      const fontStyle = typeof settings.fontStyle === "string" ? settings.fontStyle : undefined;
      const scope = splitScopes(r?.scope);
      if (scope.length === 0) {
        // Old-style global settings rule.
        const bg = typeof settings.background === "string" && isHex(settings.background) ? settings.background.toLowerCase() : undefined;
        if (fg && !colors["editor.foreground"]) colors["editor.foreground"] = fg;
        if (bg && !colors["editor.background"]) colors["editor.background"] = bg;
        continue;
      }
      if (!fg && fontStyle === undefined) continue;
      rules.push({ name: typeof r.name === "string" ? r.name : undefined, scope, foreground: fg, fontStyle });
    }
  }
  if (theme.include) warnings.push(`"include" (${String(theme.include)}) isn't followed; colors from the base theme are not imported.`);
  if (theme.semanticTokenColors) warnings.push("semanticTokenColors aren't imported.");
  if (Object.keys(colors).length === 0 && rules.length === 0) {
    throw new Error("No colors found. Is this a VS Code color theme (with \"colors\" and/or \"tokenColors\")?");
  }

  // ---- theme type
  let type: ThemeType;
  if (theme.type === "light" || theme.type === "hc-light") type = "light";
  else if (theme.type === "dark" || theme.type === "hc-black" || theme.type === "hc") type = "dark";
  else {
    const bg = colors["editor.background"] && hexToLch(colors["editor.background"]);
    type = bg && bg.l > 0.6 ? "light" : "dark";
  }

  // ---- cluster unique opaque colors, most used first
  // Key colors are weighted up so they become cluster representatives (exact),
  // and near-duplicates are expressed as offsets from them.
  const WEIGHT: Record<string, number> = { "editor.background": 1000, "editor.foreground": 500 };
  const freq = new Map<string, number>();
  const count = (hex: string, weight = 1) => {
    const base = splitAlpha(hex).hex;
    freq.set(base, (freq.get(base) ?? 0) + weight);
  };
  Object.entries(colors).forEach(([key, hex]) => count(hex, WEIGHT[key] ?? 1));
  // Syntax groups with no matching rule fall back to the foreground, so it must be a palette color.
  const fgHex = colors["editor.foreground"] ?? (type === "dark" ? "#bbbbbb" : "#333333");
  if (!colors["editor.foreground"]) count(fgHex, WEIGHT["editor.foreground"]);
  rules.forEach((r) => r.foreground && count(r.foreground));
  const unique = [...freq.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).map(([hex]) => hex);

  const clusters: Cluster[] = [];
  const clusterOf = new Map<string, Cluster>();
  for (const hex of unique) {
    const lch = hexToLch(hex)!;
    const lab = labOf(hex);
    let best: Cluster | undefined;
    let bestScore = Infinity;
    if (options.tolerance > 0) {
      for (const cl of clusters) {
        const dab = Math.hypot(lab.a - cl.a, lab.b - cl.b);
        const dl = Math.abs(lch.l - cl.lch.l);
        if (dab > options.tolerance || dl > MAX_MERGE_DL) continue;
        const score = dab + dl * 0.25;
        if (score < bestScore) {
          best = cl;
          bestScore = score;
        }
      }
    }
    if (!best) {
      best = { id: `c${clusters.length + 1}`, rep: hex, lch, a: lab.a, b: lab.b };
      clusters.push(best);
    }
    clusterOf.set(hex, best);
  }

  // ---- assignments (member = representative + lightness offset)
  let maxError = 0;
  const assignFor = (hex: string): ColorAssignment => {
    const { hex: base, alpha } = splitAlpha(hex);
    const cl = clusterOf.get(base)!;
    const a: ColorAssignment = { source: cl.id, alpha: round(alpha, 3) };
    if (base !== cl.rep) {
      const dl = round(hexToLch(base)!.l - cl.lch.l, 3);
      if (dl) a.dl = dl;
      const produced = lchToHex({ ...cl.lch, l: cl.lch.l + dl });
      maxError = Math.max(maxError, labDistance(produced, base));
    }
    return a;
  };

  // ---- roles: give well-known palette ids/names to the clusters behind key colors
  const importedRules: ResolvedRule[] = rules.map((r) => ({ selectors: r.scope, color: r.foreground, fontStyle: r.fontStyle }));
  for (const [role, sources] of ROLE_SOURCES) {
    for (const src of sources) {
      const hex = src.startsWith("token:") ? matchToken(importedRules, src.slice(6)).color : colors[src];
      // Translucent uses (e.g. a 25% accent selection) don't define a role.
      if (!hex || splitAlpha(hex).alpha < 1) continue;
      const cl = clusterOf.get(splitAlpha(hex).hex);
      if (cl && !cl.role) {
        cl.role = role;
        break;
      }
    }
  }
  for (const cl of clusters) if (cl.role) cl.id = cl.role;

  const usedNames = new Map<string, number>();
  const palette: PaletteColor[] = clusters.map((cl) => {
    const base = cl.role ? ROLE_NAMES[cl.role] : hueName(cl.lch);
    const n = (usedNames.get(base) ?? 0) + 1;
    usedNames.set(base, n);
    const neutral = cl.role ? NEUTRAL_ROLES.has(cl.role) : cl.lch.c < 0.04;
    return { id: cl.id, name: n > 1 ? `${base} ${n}` : base, group: neutral ? "neutral" : "accent", ...cl.lch };
  });

  // ---- workbench: everything the theme sets; curated keys it leaves out stay unset
  const workbench: Record<string, ColorAssignment | null> = {};
  for (const key of KNOWN_KEYS) workbench[key] = null;
  for (const [key, hex] of Object.entries(colors)) workbench[key] = assignFor(hex);

  // ---- syntax groups: whatever each group's probe scope renders as today
  const syntax: Record<string, SyntaxAssignment> = {};
  for (const g of SYNTAX_GROUPS) {
    const m = matchToken(importedRules, g.probe);
    const fontStyle = (m.fontStyle ?? "").split(/\s+/).filter((s): s is FontStyle =>
      s === "italic" || s === "bold" || s === "underline",
    );
    syntax[g.id] = { ...assignFor(m.color ?? fgHex), fontStyle };
  }

  const extraTokens: ExtraTokenRule[] = options.keepTokenRules
    ? rules.map((r) => ({
        ...(r.name ? { name: r.name } : {}),
        scope: r.scope,
        color: r.foreground ? assignFor(r.foreground) : null,
        ...(r.fontStyle !== undefined ? { fontStyle: r.fontStyle } : {}),
      }))
    : [];
  if (!options.keepTokenRules && rules.length > SYNTAX_GROUPS.length) {
    warnings.push(`${rules.length} token rules were simplified into ${SYNTAX_GROUPS.length} syntax groups.`);
  }

  const name = typeof theme.name === "string" && theme.name.trim() ? theme.name.trim() : fallbackName;

  return {
    doc: { version: 1, name, type, palette, workbench, syntax, extraTokens },
    stats: {
      uniqueColors: unique.length,
      paletteSize: palette.length,
      maxError,
      workbenchKeys: Object.keys(colors).length,
      tokenRules: rules.length,
      warnings,
    },
  };
}
