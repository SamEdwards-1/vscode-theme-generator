import type { RelationalColor } from "../engine/relational";

export interface PaletteColor extends RelationalColor {
  name: string;
}

/**
 * Where a theme color comes from: a palette id (tracks palette edits) or a
 * literal "#rrggbb", plus an alpha multiplier and an optional OKLCH lightness
 * offset (a derived color, e.g. "Background + 3%").
 */
export interface ColorAssignment {
  source: string;
  alpha: number;
  /** Lightness offset added to the source color, -1..1. */
  dl?: number;
}

export type FontStyle = "italic" | "bold" | "underline";

export interface SyntaxAssignment extends ColorAssignment {
  fontStyle: FontStyle[];
}

/** A token rule kept verbatim from an imported theme, with palette-linked color. */
export interface ExtraTokenRule {
  name?: string;
  scope: string[];
  color: ColorAssignment | null;
  /** Raw TextMate fontStyle ("" explicitly clears styles); undefined leaves it unset. */
  fontStyle?: string;
}

export interface ExtensionMeta {
  publisher: string;
  version: string;
  description: string;
}

export type ThemeType = "dark" | "light";

/** The serializable document: everything needed to rebuild a theme. */
export interface ThemeDocument {
  version: 1;
  name: string;
  type: ThemeType;
  palette: PaletteColor[];
  workbench: Record<string, ColorAssignment | null>;
  syntax: Record<string, SyntaxAssignment>;
  extraTokens?: ExtraTokenRule[];
  meta?: ExtensionMeta;
}
