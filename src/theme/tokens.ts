/** A token rule with an already-resolved color, in theme order. */
export interface ResolvedRule {
  selectors: string[];
  color?: string | null;
  fontStyle?: string;
}

export interface TokenStyle {
  color?: string;
  fontStyle?: string;
}

/**
 * Scores how well a TextMate selector matches a scope. Only the last part of a
 * descendant selector ("meta.fn variable") is considered, which is enough for
 * picking colors. Returns -1 for no match, else the number of matched segments.
 */
export function selectorScore(selector: string, scope: string): number {
  const parts = selector.trim().split(/\s+/);
  const last = parts[parts.length - 1];
  if (!last) return -1;
  if (scope !== last && !scope.startsWith(last + ".")) return -1;
  // Descendant selectors are slightly more specific than a bare selector.
  return last.split(".").length + (parts.length > 1 ? 0.5 : 0);
}

/** Resolves color and fontStyle independently, like VS Code: most specific wins, later wins ties. */
export function matchToken(rules: readonly ResolvedRule[], scope: string): TokenStyle {
  let color: string | undefined;
  let colorScore = -1;
  let fontStyle: string | undefined;
  let styleScore = -1;
  for (const rule of rules) {
    let score = -1;
    for (const sel of rule.selectors) score = Math.max(score, selectorScore(sel, scope));
    if (score < 0) continue;
    if (rule.color && score >= colorScore) {
      color = rule.color;
      colorScore = score;
    }
    if (rule.fontStyle !== undefined && score >= styleScore) {
      fontStyle = rule.fontStyle;
      styleScore = score;
    }
  }
  return { color, fontStyle };
}

/** Normalizes a tokenColors "scope" field (string with commas, or array). */
export function splitScopes(scope: unknown): string[] {
  const list = Array.isArray(scope) ? scope : typeof scope === "string" ? [scope] : [];
  return list
    .flatMap((s) => (typeof s === "string" ? s.split(",") : []))
    .map((s) => s.trim())
    .filter(Boolean);
}
