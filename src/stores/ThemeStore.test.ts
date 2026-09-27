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
    store.beginEdit("accent");
    store.updateAnchor({ l: 0.15 }); // would drag all accents nearly black
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
    store.beginEdit("accent");
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
