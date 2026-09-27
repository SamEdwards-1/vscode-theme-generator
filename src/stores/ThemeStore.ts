import { makeAutoObservable, reaction, toJS } from "mobx";
import { hexToLch, hueDelta, isInGamut, wrapHue, type Lch } from "../color/color";
import { LINK_GROUPS, presetPalette } from "../data/presets";
import { SYNTAX_GROUPS, defaultSyntax } from "../data/syntax";
import { defaultAssignment, defaultWorkbench, findWorkbenchKey } from "../data/workbench";
import {
  applyAnchorEdit,
  applyGlobalAdjust,
  followerIds,
  type BoundaryMode,
  type GlobalAdjust,
} from "../engine/relational";
import { furthestValid, guardFloors, guardViolations } from "../theme/guard";
import { ThemeView } from "../theme/view";
import type {
  ColorAssignment,
  ExtensionMeta,
  ExtraTokenRule,
  FontStyle,
  PaletteColor,
  SyntaxAssignment,
  ThemeDocument,
  ThemeType,
} from "./types";

const STORAGE_KEY = "theme-generator:document";
const SETTINGS_KEY = "theme-generator:settings";
const HISTORY_LIMIT = 200;

const NEUTRAL_GLOBAL: GlobalAdjust = { hueShift: 0, chromaScale: 1, lightOffset: 0 };
const DEFAULT_META: ExtensionMeta = { publisher: "me", version: "0.0.1", description: "" };

export type GlobalScope = "all" | string;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class ThemeStore {
  name = "Untitled";
  type: ThemeType = "dark";
  palette: PaletteColor[] = presetPalette("dark");
  workbench: Record<string, ColorAssignment | null> = defaultWorkbench("dark");
  syntax: Record<string, SyntaxAssignment> = defaultSyntax();
  /** Token rules kept from an imported theme; exported after the group rules. */
  extraTokens: ExtraTokenRule[] = [];
  meta: ExtensionMeta = { ...DEFAULT_META };

  boundaryMode: BoundaryMode = "clamp";
  crossGroup = false;
  /** Stops drags from pushing guarded text below `guardThreshold` contrast. */
  guardEnabled = true;
  guardThreshold = 4.5;

  /** The color whose editor is open in the palette panel. */
  selectedId: string | null = "accent";
  /** The color currently being dragged; followers are shown as linked to it. */
  activeAnchorId: string | null = null;
  /** Followers that hit a boundary during the latest interaction. */
  limited: string[] = [];
  /** Pairs the contrast guard is holding the current drag for. */
  guardHolding: string[] = [];

  global: GlobalAdjust = { ...NEUTRAL_GLOBAL };
  globalScope: GlobalScope = "all";
  globalActive = false;

  pastCount = 0;
  futureCount = 0;

  private snapshot: PaletteColor[] | null = null;
  private globalStart: GlobalAdjust | null = null;
  /** Last anchor value / global adjust the guard accepted during this drag. */
  private lastGoodAnchor: Lch | null = null;
  private lastGoodGlobal: GlobalAdjust | null = null;
  private floors: Map<string, number> | null = null;
  private past: ThemeDocument[] = [];
  private future: ThemeDocument[] = [];
  private limitedTimer: ReturnType<typeof setTimeout> | undefined;
  private batchDepth = 0;

  constructor() {
    makeAutoObservable<
      this,
      | "snapshot"
      | "globalStart"
      | "lastGoodAnchor"
      | "lastGoodGlobal"
      | "floors"
      | "past"
      | "future"
      | "limitedTimer"
      | "batchDepth"
    >(
      this,
      {
        snapshot: false,
        globalStart: false,
        lastGoodAnchor: false,
        lastGoodGlobal: false,
        floors: false,
        past: false,
        future: false,
        limitedTimer: false,
        batchDepth: false,
      },
      { autoBind: true },
    );
    this.load();
    reaction(
      () => this.document,
      (doc) => localStorage.setItem(STORAGE_KEY, JSON.stringify(doc)),
      { delay: 250 },
    );
    reaction(
      () => ({
        boundaryMode: this.boundaryMode,
        crossGroup: this.crossGroup,
        guardEnabled: this.guardEnabled,
        guardThreshold: this.guardThreshold,
      }),
      (s) => localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)),
    );
  }

  // ---------------------------------------------------------------- derived

  get document(): ThemeDocument {
    return {
      version: 1,
      name: this.name,
      type: this.type,
      palette: toJS(this.palette),
      workbench: toJS(this.workbench),
      syntax: toJS(this.syntax),
      extraTokens: toJS(this.extraTokens),
      meta: toJS(this.meta),
    };
  }

  /** Resolved colors for the current state. */
  get view(): ThemeView {
    return this.viewFor(this.palette);
  }

  private viewFor(palette: readonly PaletteColor[]): ThemeView {
    return new ThemeView({
      type: this.type,
      palette,
      workbench: this.workbench,
      syntax: this.syntax,
      extraTokens: this.extraTokens,
    });
  }

  get hexById(): Map<string, string> {
    const v = this.view;
    return new Map(this.palette.map((c) => [c.id, v.paletteHex(c.id)!]));
  }

  get outOfGamut(): Set<string> {
    return new Set(this.palette.filter((c) => !isInGamut(c)).map((c) => c.id));
  }

  get selected(): PaletteColor | undefined {
    return this.palette.find((c) => c.id === this.selectedId);
  }

  /** Followers of the active (or selected) anchor, for link indicators. */
  get linkedToAnchor(): Set<string> {
    const id = this.activeAnchorId ?? this.selectedId;
    return new Set(id ? followerIds(this.palette, id, this.crossGroup) : []);
  }

  get globalTargets(): string[] {
    return this.palette
      .filter((c) => this.globalScope === "all" || c.group === this.globalScope)
      .map((c) => c.id);
  }

  /** How many theme colors reference each palette id. */
  get usageCount(): Map<string, number> {
    const counts = new Map<string, number>();
    const add = (a: ColorAssignment | null | undefined) => {
      if (a && !a.source.startsWith("#")) counts.set(a.source, (counts.get(a.source) ?? 0) + 1);
    };
    Object.values(this.workbench).forEach(add);
    Object.values(this.syntax).forEach(add);
    this.extraTokens.forEach((r) => add(r.color));
    return counts;
  }

  resolve(a: ColorAssignment | null | undefined): string | null {
    return this.view.resolve(a);
  }

  /** Explicitly assigned workbench colors (what gets exported). */
  get workbenchColors(): Record<string, string> {
    const v = this.view;
    const out: Record<string, string> = {};
    for (const key of Object.keys(this.workbench)) {
      const hex = v.explicit(key);
      if (hex) out[key] = hex;
    }
    return out;
  }

  /** How each syntax group actually renders (imported rules included). */
  get syntaxColors(): Record<string, { color: string; fontStyle: FontStyle[] }> {
    const v = this.view;
    return Object.fromEntries(SYNTAX_GROUPS.map((g) => [g.id, v.token(g.id)]));
  }

  /** The VS Code color theme JSON. */
  get themeJson() {
    const v = this.view;
    const groupRules = SYNTAX_GROUPS.map((g) => {
      const s = this.syntax[g.id];
      return {
        name: g.label,
        scope: g.scopes,
        settings: {
          foreground: v.resolve(s) ?? undefined,
          ...(s.fontStyle.length ? { fontStyle: s.fontStyle.join(" ") } : {}),
        },
      };
    });
    const extraRules = this.extraTokens.map((r) => {
      const color = v.resolve(r.color);
      return {
        ...(r.name ? { name: r.name } : {}),
        scope: r.scope,
        settings: {
          ...(color ? { foreground: color } : {}),
          ...(r.fontStyle !== undefined ? { fontStyle: r.fontStyle } : {}),
        },
      };
    });
    return {
      $schema: "vscode://schemas/color-theme",
      name: this.name,
      type: this.type,
      semanticHighlighting: true,
      colors: this.workbenchColors,
      tokenColors: [...groupRules, ...extraRules],
    };
  }

  // ------------------------------------------------------ relational editing

  select(id: string | null) {
    this.selectedId = id;
  }

  /**
   * Starts a drag on `id`; later updates are measured against this snapshot.
   * With `guard`, updates that would break text contrast are held back.
   */
  beginEdit(id: string, guard = true) {
    this.checkpoint();
    this.selectedId = id;
    this.activeAnchorId = id;
    this.snapshot = toJS(this.palette);
    const anchor = this.snapshot.find((c) => c.id === id);
    this.lastGoodAnchor = anchor ? { l: anchor.l, c: anchor.c, h: anchor.h } : null;
    this.floors = guard && this.guardEnabled ? guardFloors(this.viewFor(this.snapshot), this.guardThreshold) : null;
    this.guardHolding = [];
    this.setLimited([]);
  }

  updateAnchor(next: Partial<Lch>) {
    const id = this.activeAnchorId;
    const snapshot = this.snapshot;
    const from = this.lastGoodAnchor;
    if (!id || !snapshot || !from) return;
    const opts = { mode: this.boundaryMode, crossGroup: this.crossGroup };
    const target: Lch = { ...from, ...next };
    let result = applyAnchorEdit(snapshot, id, target, opts);

    const floors = this.floors;
    if (floors) {
      const at = (t: number): Lch => ({
        l: lerp(from.l, target.l, t),
        c: lerp(from.c, target.c, t),
        h: wrapHue(from.h + hueDelta(from.h, target.h) * t),
      });
      const passes = (t: number) =>
        guardViolations(this.viewFor(applyAnchorEdit(snapshot, id, at(t), opts).colors), floors).length === 0;
      const t = furthestValid(passes);
      this.guardHolding = t < 1 ? guardViolations(this.viewFor(result.colors), floors) : [];
      if (t < 1) result = applyAnchorEdit(snapshot, id, at(t), opts);
      this.lastGoodAnchor = at(t);
    } else {
      this.lastGoodAnchor = target;
    }

    this.palette = result.colors;
    this.limited = result.limited;
  }

  endEdit() {
    this.activeAnchorId = null;
    this.snapshot = null;
    this.lastGoodAnchor = null;
    this.floors = null;
    this.fadeLimited();
  }

  /** A one-shot, unguarded relational edit, e.g. typing a hex value. */
  editColor(id: string, next: Partial<Lch>) {
    this.beginEdit(id, false);
    this.updateAnchor(next);
    this.endEdit();
  }

  setHex(id: string, hex: string) {
    const lch = hexToLch(hex);
    if (lch) this.editColor(id, lch);
  }

  beginGlobal() {
    this.checkpoint();
    this.globalActive = true;
    this.snapshot = toJS(this.palette);
    this.globalStart = { ...this.global };
    this.lastGoodGlobal = { ...this.global };
    this.floors = this.guardEnabled ? guardFloors(this.viewFor(this.snapshot), this.guardThreshold) : null;
    this.guardHolding = [];
    this.setLimited([]);
  }

  setGlobal(patch: Partial<GlobalAdjust>) {
    const snapshot = this.snapshot;
    const start = this.globalStart;
    const from = this.lastGoodGlobal;
    if (!snapshot || !start || !from) {
      this.global = { ...this.global, ...patch };
      return;
    }
    const target = { ...from, ...patch };
    const apply = (g: GlobalAdjust) =>
      applyGlobalAdjust(
        snapshot,
        this.globalTargets,
        {
          hueShift: g.hueShift - start.hueShift,
          chromaScale: start.chromaScale > 0 ? g.chromaScale / start.chromaScale : 1,
          lightOffset: g.lightOffset - start.lightOffset,
        },
        this.boundaryMode,
      );

    let accepted = target;
    const floors = this.floors;
    if (floors) {
      const at = (t: number): GlobalAdjust => ({
        hueShift: lerp(from.hueShift, target.hueShift, t),
        chromaScale: lerp(from.chromaScale, target.chromaScale, t),
        lightOffset: lerp(from.lightOffset, target.lightOffset, t),
      });
      const passes = (t: number) => guardViolations(this.viewFor(apply(at(t)).colors), floors).length === 0;
      const t = furthestValid(passes);
      this.guardHolding = t < 1 ? guardViolations(this.viewFor(apply(target).colors), floors) : [];
      accepted = at(t);
    }

    const { colors, limited } = apply(accepted);
    this.lastGoodGlobal = accepted;
    this.global = accepted;
    this.palette = colors;
    this.limited = limited;
  }

  endGlobal() {
    this.globalActive = false;
    this.snapshot = null;
    this.globalStart = null;
    this.lastGoodGlobal = null;
    this.floors = null;
    this.fadeLimited();
  }

  /** Zeroes the master sliders' readouts without touching colors. */
  resetGlobalReadout() {
    this.global = { ...NEUTRAL_GLOBAL };
  }

  setGlobalScope(scope: GlobalScope) {
    this.globalScope = scope;
    this.resetGlobalReadout();
  }

  setBoundaryMode(mode: BoundaryMode) {
    this.boundaryMode = mode;
  }

  setCrossGroup(on: boolean) {
    this.crossGroup = on;
  }

  setGuard(enabled: boolean, threshold = this.guardThreshold) {
    this.guardEnabled = enabled;
    this.guardThreshold = threshold;
  }

  private setLimited(ids: string[]) {
    clearTimeout(this.limitedTimer);
    this.limited = ids;
  }

  /** Boundary dots and the guard message linger briefly after release, then clear. */
  private fadeLimited() {
    clearTimeout(this.limitedTimer);
    const delay = this.guardHolding.length ? 3500 : 1500;
    this.limitedTimer = setTimeout(() => this.clearIndicators(), delay);
  }

  private clearIndicators() {
    this.limited = [];
    this.guardHolding = [];
  }

  // ---------------------------------------------------------- palette CRUD

  setColorGroup(id: string, group: string | null) {
    this.checkpoint();
    const c = this.palette.find((p) => p.id === id);
    if (c) c.group = group;
  }

  /** Cycles a color through the link groups, then "unlinked". */
  cycleColorGroup(id: string) {
    const c = this.palette.find((p) => p.id === id);
    if (!c) return;
    const order = [...LINK_GROUPS.map((g) => g.id), null];
    this.setColorGroup(id, order[(order.indexOf(c.group) + 1) % order.length]);
  }

  renameColor(id: string, name: string) {
    this.checkpoint();
    const c = this.palette.find((p) => p.id === id);
    if (c) c.name = name;
  }

  addColor() {
    this.checkpoint();
    const base = this.selected ?? this.palette[0];
    const id = `c${Date.now().toString(36)}`;
    this.palette.push({
      id,
      name: `Color ${this.palette.length + 1}`,
      l: base?.l ?? 0.6,
      c: base?.c ?? 0.12,
      h: wrapHue((base?.h ?? 0) + 30),
      group: null,
    });
    this.selectedId = id;
  }

  /** Removes a color; anything that referenced it keeps its last look as a literal. */
  removeColor(id: string) {
    const hex = this.hexById.get(id);
    if (!hex) return;
    this.checkpoint();
    const detach = (a: ColorAssignment | null) => {
      if (!a || a.source !== id) return;
      // Bake the derived offset into the literal so the color doesn't change.
      const resolved = this.view.resolve({ ...a, alpha: 1 })!;
      a.source = resolved;
      delete a.dl;
    };
    Object.values(this.workbench).forEach(detach);
    Object.values(this.syntax).forEach(detach);
    this.extraTokens.forEach((r) => detach(r.color));
    this.palette = this.palette.filter((c) => c.id !== id);
    if (this.selectedId === id) this.selectedId = this.palette[0]?.id ?? null;
  }

  // ---------------------------------------------------------- assignments

  setWorkbench(key: string, a: ColorAssignment | null) {
    this.checkpoint();
    this.workbench[key] = a;
  }

  resetWorkbenchKey(key: string) {
    const def = findWorkbenchKey(key);
    if (def) this.setWorkbench(key, defaultAssignment(def, this.type));
  }

  setSyntax(id: string, patch: Partial<SyntaxAssignment>) {
    this.checkpoint();
    this.syntax[id] = { ...this.syntax[id], ...patch };
  }

  toggleFontStyle(id: string, style: FontStyle) {
    const cur = this.syntax[id]?.fontStyle ?? [];
    this.setSyntax(id, {
      fontStyle: cur.includes(style) ? cur.filter((s) => s !== style) : [...cur, style],
    });
  }

  setExtraTokenColor(index: number, color: ColorAssignment | null) {
    this.checkpoint();
    const r = this.extraTokens[index];
    if (r) r.color = color;
  }

  /** Drops imported rules so the ten syntax groups fully control token colors. */
  clearExtraTokens() {
    this.checkpoint();
    this.extraTokens = [];
  }

  // ------------------------------------------------------------ document

  setName(name: string) {
    this.name = name;
  }

  setMeta(patch: Partial<ExtensionMeta>) {
    this.meta = { ...this.meta, ...patch };
  }

  setType(type: ThemeType) {
    this.checkpoint();
    this.type = type;
  }

  /** Starts over from a preset palette with default assignments. */
  newTheme(type: ThemeType) {
    this.checkpoint();
    this.applyDocument({
      version: 1,
      name: "Untitled",
      type,
      palette: presetPalette(type),
      workbench: defaultWorkbench(type),
      syntax: defaultSyntax(),
      meta: { ...this.meta },
    });
    this.selectedId = "accent";
  }

  importDocument(doc: ThemeDocument) {
    this.checkpoint();
    this.applyDocument(doc);
    this.selectedId = this.palette.find((c) => c.id === "accent")?.id ?? this.palette[0]?.id ?? null;
  }

  private applyDocument(doc: ThemeDocument) {
    this.name = doc.name;
    this.type = doc.type;
    this.palette = doc.palette.map((c) => ({ ...c }));
    // Merge so documents saved before new keys were added still get defaults.
    // (Imported themes set unknown-to-them keys to null explicitly.)
    this.workbench = { ...defaultWorkbench(doc.type), ...doc.workbench };
    this.syntax = { ...defaultSyntax(), ...doc.syntax };
    this.extraTokens = doc.extraTokens ? doc.extraTokens.map((r) => ({ ...r })) : [];
    this.meta = { ...DEFAULT_META, ...doc.meta };
    this.resetGlobalReadout();
  }

  private load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const doc = JSON.parse(raw) as ThemeDocument;
        if (doc.version === 1 && Array.isArray(doc.palette)) this.applyDocument(doc);
      }
      const settings = localStorage.getItem(SETTINGS_KEY);
      if (settings) {
        const s = JSON.parse(settings);
        if (s.boundaryMode) this.boundaryMode = s.boundaryMode;
        this.crossGroup = !!s.crossGroup;
        if (typeof s.guardEnabled === "boolean") this.guardEnabled = s.guardEnabled;
        if (typeof s.guardThreshold === "number") this.guardThreshold = s.guardThreshold;
      }
    } catch {
      // Corrupt or unavailable storage: keep defaults.
    }
    if (!this.palette.some((c) => c.id === this.selectedId)) {
      this.selectedId = this.palette[0]?.id ?? null;
    }
  }

  // ------------------------------------------------------------- history

  /**
   * Groups everything until endBatch() into one undo step, e.g. a slider drag
   * or typing into a name field.
   */
  beginBatch() {
    this.checkpoint();
    this.batchDepth++;
  }

  endBatch() {
    this.batchDepth = Math.max(0, this.batchDepth - 1);
  }

  private checkpoint() {
    if (this.batchDepth > 0) return;
    this.past.push(this.document);
    if (this.past.length > HISTORY_LIMIT) this.past.shift();
    this.future = [];
    this.syncHistoryCounts();
  }

  undo() {
    const prev = this.past.pop();
    if (!prev) return;
    this.future.push(this.document);
    this.applyDocument(prev);
    this.syncHistoryCounts();
  }

  redo() {
    const next = this.future.pop();
    if (!next) return;
    this.past.push(this.document);
    this.applyDocument(next);
    this.syncHistoryCounts();
  }

  private syncHistoryCounts() {
    this.pastCount = this.past.length;
    this.futureCount = this.future.length;
  }
}

export const store = new ThemeStore();
