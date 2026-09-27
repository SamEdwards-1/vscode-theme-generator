import {
  clampChroma,
  converter,
  displayable,
  formatHex,
  parse,
  wcagContrast,
} from "culori";

/** OKLCH coordinates. l: 0–1, c: 0–C_MAX, h: 0–360 degrees. */
export interface Lch {
  l: number;
  c: number;
  h: number;
}

export const L_MAX = 1;
/** Practical chroma ceiling; sRGB tops out around 0.37. */
export const C_MAX = 0.4;

const toOklch = converter("oklch");

export const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

export const wrapHue = (h: number) => ((h % 360) + 360) % 360;

/** Shortest signed angular distance from `from` to `to`, in (-180, 180]. */
export function hueDelta(from: number, to: number): number {
  const d = wrapHue(to - from);
  return d > 180 ? d - 360 : d;
}

/** Converts OKLCH to an sRGB hex, reducing chroma to fit the gamut if needed. */
export function lchToHex({ l, c, h }: Lch): string {
  return formatHex(clampChroma({ mode: "oklch", l, c, h }, "oklch"));
}

export function isInGamut({ l, c, h }: Lch): boolean {
  return displayable({ mode: "oklch", l, c, h });
}

export function hexToLch(input: string): Lch | null {
  const parsed = parse(input);
  if (!parsed) return null;
  const o = toOklch(parsed);
  return { l: o.l, c: o.c, h: wrapHue(o.h ?? 0) };
}

export function isHex(value: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value);
}

/** Appends an alpha byte to a 6-digit hex when alpha < 1. */
export function withAlpha(hex: string, alpha: number): string {
  const base = hex.slice(0, 7);
  if (alpha >= 1) return base;
  const byte = Math.round(clamp(alpha, 0, 1) * 255)
    .toString(16)
    .padStart(2, "0");
  return base + byte;
}

/** Splits a #rrggbb[aa] string into its opaque hex and alpha. */
export function splitAlpha(hex: string): { hex: string; alpha: number } {
  const full = parse(hex);
  if (!full) return { hex: "#000000", alpha: 1 };
  return { hex: formatHex(full), alpha: full.alpha ?? 1 };
}

/** Composites a possibly-translucent color over an opaque background. */
export function composite(fg: string, bg: string): string {
  const f = parse(fg);
  const b = parse(bg);
  if (!f || !b) return fg;
  const rgb = converter("rgb");
  const fr = rgb(f);
  const br = rgb(b);
  const a = fr.alpha ?? 1;
  return formatHex({
    mode: "rgb",
    r: fr.r * a + br.r * (1 - a),
    g: fr.g * a + br.g * (1 - a),
    b: fr.b * a + br.b * (1 - a),
  });
}

/** WCAG 2 contrast ratio; translucent foregrounds are composited over bg first. */
export function contrastRatio(fg: string, bg: string): number {
  return wcagContrast(composite(fg, bg), bg);
}

export function contrastGrade(ratio: number): "AAA" | "AA" | "AA18" | "Fail" {
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA18";
  return "Fail";
}

/** Picks black or white text, whichever reads better on `bg`. */
export function readableOn(bg: string): string {
  return wcagContrast(bg, "#000000") >= wcagContrast(bg, "#ffffff")
    ? "#000000"
    : "#ffffff";
}
