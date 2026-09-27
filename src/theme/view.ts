import { clamp, hexToLch, lchToHex, withAlpha, type Lch } from "../color/color";
import { SYNTAX_GROUPS } from "../data/syntax";
import { colorWithDefault } from "../data/vscodeDefaults";
import type {
  ColorAssignment,
  ExtraTokenRule,
  FontStyle,
  SyntaxAssignment,
  ThemeType,
} from "../stores/types";
import { matchToken, type ResolvedRule } from "./tokens";

export const MISSING = "#ff00ff";

export interface ThemeInputs {
  type: ThemeType;
  palette: readonly (Lch & { id: string })[];
  workbench: Record<string, ColorAssignment | null>;
  syntax: Record<string, SyntaxAssignment>;
  extraTokens?: readonly ExtraTokenRule[];
}

export interface TokenLook {
  color: string;
  fontStyle: FontStyle[];
}

/**
 * Resolves a theme's colors for one palette state. Lazy and memoized, so it is
 * cheap to build many of these while searching (e.g. the contrast guard).
 */
export class ThemeView {
  private readonly byId: Map<string, Lch & { id: string }>;
  private readonly hexCache = new Map<string, string>();
  private readonly colorCache = new Map<string, string | null>();
  private rulesCache: ResolvedRule[] | null = null;

  constructor(readonly inputs: ThemeInputs) {
    this.byId = new Map(inputs.palette.map((c) => [c.id, c]));
  }

  paletteHex(id: string): string | undefined {
    let hex = this.hexCache.get(id);
    if (hex === undefined) {
      const c = this.byId.get(id);
      if (!c) return undefined;
      hex = lchToHex(c);
      this.hexCache.set(id, hex);
    }
    return hex;
  }

  /** Assignment → #rrggbb[aa], applying the lightness offset and alpha. */
  resolve(a: ColorAssignment | null | undefined): string | null {
    if (!a) return null;
    const dl = a.dl ?? 0;
    let base: string;
    if (a.source.startsWith("#")) {
      const lch = dl ? hexToLch(a.source) : null;
      base = lch ? lchToHex({ ...lch, l: clamp(lch.l + dl, 0, 1) }) : a.source.slice(0, 7);
    } else {
      const c = this.byId.get(a.source);
      if (!c) base = MISSING;
      else base = dl ? lchToHex({ ...c, l: clamp(c.l + dl, 0, 1) }) : this.paletteHex(c.id)!;
    }
    return withAlpha(base, a.alpha);
  }

  /** The explicitly assigned color for a workbench key, or null when unset. */
  explicit(key: string): string | null {
    if (!this.colorCache.has(key)) this.colorCache.set(key, this.resolve(this.inputs.workbench[key]));
    return this.colorCache.get(key)!;
  }

  /** What VS Code would draw for a key: explicit, else its built-in default. */
  color(key: string): string | null {
    return colorWithDefault((k) => this.explicit(k), key, this.inputs.type);
  }

  /** Group rules first, imported rules after, so imported rules win ties (as imported). */
  get rules(): ResolvedRule[] {
    if (!this.rulesCache) {
      const groups: ResolvedRule[] = SYNTAX_GROUPS.map((g) => {
        const s = this.inputs.syntax[g.id];
        return { selectors: g.scopes, color: this.resolve(s), fontStyle: s?.fontStyle.join(" ") ?? "" };
      });
      const extras: ResolvedRule[] = (this.inputs.extraTokens ?? []).map((r) => ({
        selectors: r.scope,
        color: this.resolve(r.color),
        fontStyle: r.fontStyle,
      }));
      this.rulesCache = [...groups, ...extras];
    }
    return this.rulesCache;
  }

  /** How a scope actually renders once all rules are applied. */
  tokenFor(scope: string): TokenLook {
    const m = matchToken(this.rules, scope);
    return {
      color: m.color ?? this.color("editor.foreground") ?? MISSING,
      fontStyle: (m.fontStyle ?? "").split(/\s+/).filter(Boolean) as FontStyle[],
    };
  }

  /** How a syntax group renders (probing its representative scope). */
  token(groupId: string): TokenLook {
    const g = SYNTAX_GROUPS.find((x) => x.id === groupId);
    return g ? this.tokenFor(g.probe) : { color: MISSING, fontStyle: [] };
  }
}
