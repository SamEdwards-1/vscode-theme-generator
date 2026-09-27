import { C_MAX, L_MAX, clamp, hueDelta, wrapHue, type Lch } from "../color/color";

/**
 * How followers behave when a shared delta would push them past 0 or the max:
 * - clamp:        follower = clamp(old + Δ). Offsets break once a follower hits the edge.
 * - proportional: Δ is scaled by the follower's remaining headroom relative to the
 *                 anchor's, so colors near an edge compress instead of flattening.
 * - preserve:     the whole linked set moves rigidly; the followers stop together
 *                 as soon as any one of them would clip.
 */
export type BoundaryMode = "clamp" | "proportional" | "preserve";

export interface RelationalColor extends Lch {
  id: string;
  /** Link group id; null means the color moves on its own. */
  group: string | null;
}

export interface LinkOptions {
  mode: BoundaryMode;
  /** When true, every linked color follows regardless of which group it is in. */
  crossGroup: boolean;
}

export interface EditResult<T> {
  colors: T[];
  /** Followers whose movement was limited by a boundary on some axis. */
  limited: string[];
}

const EPS = 1e-6;

export function followerIds<T extends RelationalColor>(
  colors: readonly T[],
  anchorId: string,
  crossGroup: boolean,
): string[] {
  const anchor = colors.find((c) => c.id === anchorId);
  if (!anchor || anchor.group === null) return [];
  return colors
    .filter(
      (c) =>
        c.id !== anchorId &&
        c.group !== null &&
        (crossGroup || c.group === anchor.group),
    )
    .map((c) => c.id);
}

/**
 * Shifts a bounded axis for a set of followers.
 * Returns the new values plus which followers were limited.
 */
export function shiftAxis(
  values: readonly number[],
  delta: number,
  anchorOld: number,
  max: number,
  mode: BoundaryMode,
): { values: number[]; limited: boolean[] } {
  if (Math.abs(delta) < EPS) {
    return { values: [...values], limited: values.map(() => false) };
  }
  const up = delta > 0;

  if (mode === "preserve") {
    const room = values.reduce(
      (min, v) => Math.min(min, up ? max - v : v),
      Infinity,
    );
    const d = up ? Math.min(delta, room) : Math.max(delta, -room);
    const limited = Math.abs(d) < Math.abs(delta) - EPS;
    return {
      values: values.map((v) => clamp(v + d, 0, max)),
      limited: values.map(() => limited),
    };
  }

  if (mode === "proportional") {
    const anchorRoom = up ? max - anchorOld : anchorOld;
    const out = values.map((v) => {
      const room = up ? max - v : v;
      const ratio = anchorRoom > EPS ? Math.min(1, room / anchorRoom) : 1;
      return { v: clamp(v + delta * ratio, 0, max), limited: ratio < 1 - EPS };
    });
    return { values: out.map((o) => o.v), limited: out.map((o) => o.limited) };
  }

  const raw = values.map((v) => v + delta);
  return {
    values: raw.map((v) => clamp(v, 0, max)),
    limited: raw.map((v) => v < -EPS || v > max + EPS),
  };
}

/**
 * Applies an edit to the anchor and broadcasts its delta to linked followers.
 * All deltas are measured against `snapshot` (the palette at drag start), so
 * repeated calls during a drag never accumulate rounding or clipping error.
 */
export function applyAnchorEdit<T extends RelationalColor>(
  snapshot: readonly T[],
  anchorId: string,
  next: Partial<Lch>,
  options: LinkOptions,
): EditResult<T> {
  const snapAnchor = snapshot.find((c) => c.id === anchorId);
  if (!snapAnchor) return { colors: [...snapshot], limited: [] };

  const anchor: T = {
    ...snapAnchor,
    l: clamp(next.l ?? snapAnchor.l, 0, L_MAX),
    c: clamp(next.c ?? snapAnchor.c, 0, C_MAX),
    h: wrapHue(next.h ?? snapAnchor.h),
  };

  const ids = new Set(followerIds(snapshot, anchorId, options.crossGroup));
  const followers = snapshot.filter((c) => ids.has(c.id));

  const dL = anchor.l - snapAnchor.l;
  const dC = anchor.c - snapAnchor.c;
  const dH = hueDelta(snapAnchor.h, anchor.h);

  const ls = shiftAxis(followers.map((f) => f.l), dL, snapAnchor.l, L_MAX, options.mode);
  const cs = shiftAxis(followers.map((f) => f.c), dC, snapAnchor.c, C_MAX, options.mode);

  const moved = new Map<string, T>();
  const limited: string[] = [];
  followers.forEach((f, i) => {
    moved.set(f.id, { ...f, l: ls.values[i], c: cs.values[i], h: wrapHue(f.h + dH) });
    if (ls.limited[i] || cs.limited[i]) limited.push(f.id);
  });

  return {
    colors: snapshot.map((c) =>
      c.id === anchorId ? anchor : (moved.get(c.id) ?? c),
    ),
    limited,
  };
}

export interface GlobalAdjust {
  /** Degrees added to every hue. */
  hueShift: number;
  /** Multiplier applied to chroma (1 = unchanged). */
  chromaScale: number;
  /** Added to lightness (-1..1). */
  lightOffset: number;
}

/**
 * Applies master controls to a subset of the palette, relative to a snapshot.
 * Lightness uses the same boundary modes as anchor edits, with the subset's
 * mean lightness standing in for the anchor.
 */
export function applyGlobalAdjust<T extends RelationalColor>(
  snapshot: readonly T[],
  targetIds: readonly string[],
  adjust: GlobalAdjust,
  mode: BoundaryMode,
): EditResult<T> {
  const ids = new Set(targetIds);
  const targets = snapshot.filter((c) => ids.has(c.id));
  if (targets.length === 0) return { colors: [...snapshot], limited: [] };

  const meanL = targets.reduce((s, c) => s + c.l, 0) / targets.length;
  const ls = shiftAxis(targets.map((t) => t.l), adjust.lightOffset, meanL, L_MAX, mode);

  let scale = Math.max(0, adjust.chromaScale);
  if (mode === "preserve" && scale > 1) {
    const maxC = Math.max(...targets.map((t) => t.c));
    if (maxC > EPS) scale = Math.min(scale, C_MAX / maxC);
  }

  const moved = new Map<string, T>();
  const limited: string[] = [];
  targets.forEach((t, i) => {
    const rawC = t.c * scale;
    moved.set(t.id, {
      ...t,
      l: ls.values[i],
      c: clamp(rawC, 0, C_MAX),
      h: wrapHue(t.h + adjust.hueShift),
    });
    if (ls.limited[i] || rawC > C_MAX + EPS || scale < adjust.chromaScale - EPS) {
      limited.push(t.id);
    }
  });

  return { colors: snapshot.map((c) => moved.get(c.id) ?? c), limited };
}
