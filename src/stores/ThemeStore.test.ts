import { beforeEach, describe, expect, it, vi } from "vitest";

// The store persists to localStorage; give node a minimal in-memory one.
const mem = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
});

const { ThemeStore } = await import("./ThemeStore");
const colorLib = await import("../color/color");

describe("ThemeStore", () => {
  let store: InstanceType<typeof ThemeStore>;
  beforeEach(() => {
    mem.clear();
    store = new ThemeStore();
  });

  it("exports a VS Code theme whose colors track the palette", () => {
    const before = store.themeJson.colors["statusBar.background"];
    store.setHex("accent", "#ff0000");
    const after = store.themeJson.colors["statusBar.background"];
    expect(after).not.toBe(before);
    expect(after).toBe(store.hexById.get("accent"));
    expect(store.themeJson.type).toBe("dark");
    expect(store.themeJson.tokenColors.length).toBeGreaterThan(5);
  });

  it("applies alpha as an 8-digit hex", () => {
    expect(store.themeJson.colors["editor.findMatchBackground"]).toMatch(/^#[0-9a-f]{8}$/);
  });

  it("moves linked colors with the anchor and leaves other groups alone", () => {
    store.setColorGroup("red", "accent");
    const bg = store.hexById.get("bg");
    const red = store.palette.find((c) => c.id === "red")!.h;
    store.beginEdit("accent");
    const a = store.palette.find((c) => c.id === "accent")!;
    store.updateAnchor({ h: a.h + 40 });
    store.endEdit();
    expect(store.palette.find((c) => c.id === "red")!.h).toBeCloseTo((red + 40) % 360);
    expect(store.hexById.get("bg")).toBe(bg);
  });

  it("undoes a whole drag as one step", () => {
    store.setGuard(false);
    const start = store.hexById.get("accent");
    store.beginEdit("accent");
    store.updateAnchor({ l: 0.2 });
    store.updateAnchor({ l: 0.3 });
    store.endEdit();
    store.undo();
    expect(store.hexById.get("accent")).toBe(start);
    store.redo();
    expect(store.hexById.get("accent")).not.toBe(start);
  });

  it("keeps the last hex for references when a palette color is removed", () => {
    const hex = store.hexById.get("green")!;
    store.removeColor("green");
    expect(store.workbench["terminal.ansiGreen"]).toEqual({ source: hex, alpha: 1 });
    expect(store.syntax.string.source).toBe(hex);
  });

  it("restores the saved document on construction", async () => {
    store.setName("Persisted");
    await new Promise((r) => setTimeout(r, 300)); // save is debounced
    expect(new ThemeStore().name).toBe("Persisted");
  });

  it("contrast guard stops a drag before text drops below its floor", () => {
    const { contrastRatio } = colorLib;
    store.setGuard(true, 3);
    const before = store.syntaxColors.string.color;
    store.beginEdit("green");
    store.updateAnchor({ l: 0.15 }); // would drag linked syntax colors nearly black
    expect(store.guardHolding.length).toBeGreaterThan(0);
    store.endEdit();
    expect(store.syntaxColors.string.color).not.toBe(before); // moved partway…
    const bg = store.view.color("editor.background")!;
    for (const id of ["string", "keyword", "variable", "function"]) {
      expect(contrastRatio(store.syntaxColors[id].color, bg)).toBeGreaterThanOrEqual(2.95); // …but stopped at 3:1
    }
  });

  it("contrast guard ignores pairs that already fail", () => {
    const { contrastRatio } = colorLib;
    store.setGuard(true, 4.5);
    const bg = store.view.color("editor.background")!;
    const red = store.syntaxColors.variable.color;
    expect(contrastRatio(red, bg)).toBeLessThan(4.5); // 4.4:1 in the default dark theme
    store.setColorGroup("red", "syntax");
    store.beginEdit("green");
    store.updateAnchor({ l: 0.15 });
    store.endEdit();
    // Strings (6.9:1) are guarded, so the move stops at 4.5:1 for them…
    expect(contrastRatio(store.syntaxColors.string.color, bg)).toBeGreaterThanOrEqual(4.45);
    // …while the already-failing red was free to move.
    expect(store.syntaxColors.variable.color).not.toBe(red);
  });

  it("contrast guard is skipped for typed hex values", () => {
    store.setGuard(true, 4.5);
    store.setHex("accent", "#101010");
    expect(store.hexById.get("accent")).toBe("#101010");
  });

  it("keeps text, surfaces, syntax and status independent of the accent by default", () => {
    const before = store.document.palette.filter((c) => c.id !== "accent");
    store.setHex("accent", "#f28c28");
    expect(store.document.palette.filter((c) => c.id !== "accent")).toEqual(before);
    expect(store.palette.find((c) => c.id === "fg")!.group).not.toBe(store.palette.find((c) => c.id === "bg")!.group);
  });

  it("unlinks and relinks a color to the same group, across save and reload", () => {
    store.setColorGroup("green", "extra");
    store.toggleColorLink("green");
    const draft = store.document;
    expect(draft.palette.find((c) => c.id === "green")!.group).toBeNull();
    store.importDocument(draft);
    store.toggleColorLink("green");
    expect(store.palette.find((c) => c.id === "green")!.group).toBe("extra");
    store.undo();
    expect(store.palette.find((c) => c.id === "green")!.group).toBeNull();
  });

  it("resets just one color to its original value, undoably", () => {
    store.setGuard(false);
    const original = store.hexById.get("green");
    store.setHex("green", "#7755ff");
    const follower = store.hexById.get("blue");
    const changed = store.hexById.get("green");
    store.resetColor("green");
    expect(store.hexById.get("green")).toBe(original);
    expect(store.hexById.get("blue")).toBe(follower);
    store.undo();
    expect(store.hexById.get("green")).toBe(changed);
    store.redo();
    expect(store.hexById.get("green")).toBe(original);
  });

  it("uses opening values as reset values for old projects", () => {
    const doc = store.document;
    for (const c of doc.palette) delete c.original;
    doc.palette[0].l = 0.5;
    store.importDocument(doc);
    store.setHex("bg", "#111111");
    store.resetColor("bg");
    expect(store.palette[0].l).toBe(0.5);
  });

  it("restores the picker opening palette including followers in one undo step", () => {
    store.setGuard(false);
    const before = store.document.palette;
    store.setHex("green", "#5577ee");
    const changed = store.document.palette;
    store.restorePalette(before);
    expect(store.document.palette).toEqual(before);
    store.undo();
    expect(store.document.palette).toEqual(changed);
  });

  it("regroups old palettes by use, leaving black and white overlays unlinked", () => {
    store.addColor();
    const overlay = store.selectedId!;
    store.setHex(overlay, "#000000");
    store.setColorGroup(overlay, "neutral");
    const before = store.document;
    store.groupByRole();
    expect(store.palette.find((c) => c.id === overlay)!.group).toBeNull();
    expect(store.palette.find((c) => c.id === "bg")!.group).toBe("surface");
    expect(store.palette.find((c) => c.id === "fg")!.group).toBe("text");
    store.undo();
    expect(store.document).toEqual(before);
  });

  it("rejects malformed imports before changing the draft or its undo history", () => {
    const before = store.document;
    const broken = store.document;
    broken.palette[0].l = NaN;
    expect(() => store.importDocument(broken)).toThrow("Invalid palette");
    expect(store.document).toEqual(before);
    expect(store.pastCount).toBe(0);
  });

  it("resolves derived colors with a lightness offset", () => {
    const base = store.palette.find((c) => c.id === "bgAlt")!;
    const hover = store.workbench["list.hoverBackground"]!;
    expect(hover).toEqual({ source: "bgAlt", alpha: 1, dl: 0.04 });
    const resolved = store.resolve(hover)!;
    expect(resolved).not.toBe(store.hexById.get("bgAlt"));
    // Moving the palette color moves the derived color too.
    store.setHex("bgAlt", "#402020");
    expect(store.resolve(hover)).not.toBe(resolved);
    expect(base.id).toBe("bgAlt");
  });

  it("flips derived offsets for light themes", () => {
    store.newTheme("light");
    expect(store.workbench["list.hoverBackground"]!.dl).toBe(-0.04);
  });

  it("removing a color bakes derived offsets into literals", () => {
    const hover = store.resolve(store.workbench["list.hoverBackground"])!;
    store.removeColor("bgAlt");
    expect(store.workbench["list.hoverBackground"]).toEqual({ source: hover, alpha: 1 });
  });
});
