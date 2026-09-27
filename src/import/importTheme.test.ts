import { describe, expect, it } from "vitest";
import { ThemeView } from "../theme/view";
import { importVSCodeTheme } from "./importTheme";
import { parseJsonc } from "./jsonc";

const SOURCE = `{
  // A small theme with the things real theme files contain
  "name": "Fixture Dark",
  "type": "dark",
  "colors": {
    "editor.background": "#1e2127",
    "editor.foreground": "#abb2bf",
    "sideBar.background": "#1b1e23", /* close to the editor background */
    "list.hoverBackground": "#2c313a",
    "focusBorder": "#528bff",
    "button.background": "#528bff",
    "editor.selectionBackground": "#528bff40",
    "custom.unknownKey": "#ff0000",
    "notAColor": "red",
  },
  "tokenColors": [
    { "settings": { "foreground": "#abb2bf" } },
    { "scope": "comment", "settings": { "foreground": "#5c6370", "fontStyle": "italic" } },
    { "scope": "keyword, storage.type", "settings": { "foreground": "#c678dd" } },
    { "scope": ["string"], "settings": { "foreground": "#98c379" } },
    { "scope": "string.url", "settings": { "fontStyle": "underline" } },
    { "scope": "entity.name.function", "settings": { "foreground": "#61afef", "fontStyle": "bold" } },
  ],
}`;

const theme = parseJsonc(SOURCE) as { colors: Record<string, string> };

describe("parseJsonc", () => {
  it("handles comments and trailing commas without touching strings", () => {
    expect(parseJsonc(`{"a": "http://x.y/*z*/", // c\n "b": [1, 2,],}`)).toEqual({ a: "http://x.y/*z*/", b: [1, 2] });
  });
});

describe("importVSCodeTheme", () => {
  it("reproduces every color exactly with tolerance 0", () => {
    const { doc, stats } = importVSCodeTheme(theme, { tolerance: 0, keepTokenRules: true });
    const view = new ThemeView(doc);
    for (const [key, hex] of Object.entries(theme.colors)) {
      if (hex === "red") continue;
      expect(view.explicit(key), key).toBe(hex);
    }
    expect(stats.maxError).toBe(0);
    expect(stats.warnings.join(" ")).toMatch(/1 color value/);
  });

  it("keeps unknown keys and unsets curated keys the theme leaves out", () => {
    const { doc } = importVSCodeTheme(theme, { tolerance: 0, keepTokenRules: true });
    expect(doc.workbench["custom.unknownKey"]).toBeTruthy();
    expect(doc.workbench["statusBar.background"]).toBeNull();
  });

  it("names clusters by role and links repeated colors to one palette entry", () => {
    const { doc } = importVSCodeTheme(theme, { tolerance: 0, keepTokenRules: true });
    const ids = doc.palette.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(["bg", "fg", "bgAlt", "accent", "fgMuted"]));
    expect(doc.workbench["focusBorder"]).toEqual({ source: "accent", alpha: 1 });
    expect(doc.workbench["editor.selectionBackground"]).toEqual({ source: "accent", alpha: 0.251 });
  });

  it("merges near colors into derived offsets when tolerance > 0", () => {
    const { doc, stats } = importVSCodeTheme(theme, { tolerance: 0.02, keepTokenRules: true });
    expect(doc.workbench["sideBar.background"]).toMatchObject({ source: "bg" });
    expect(doc.workbench["sideBar.background"]!.dl).toBeLessThan(0);
    expect(stats.paletteSize).toBeLessThan(stats.uniqueColors);
    expect(stats.maxError).toBeLessThan(0.02);
  });

  it("maps syntax groups from token rules, including font styles", () => {
    const { doc } = importVSCodeTheme(theme, { tolerance: 0, keepTokenRules: false });
    const view = new ThemeView(doc);
    expect(view.token("comment")).toEqual({ color: "#5c6370", fontStyle: ["italic"] });
    expect(view.token("keyword").color).toBe("#c678dd");
    expect(view.token("function")).toEqual({ color: "#61afef", fontStyle: ["bold"] });
    expect(doc.extraTokens).toEqual([]);
  });

  it("keeps imported token rules verbatim when asked, so specific scopes still win", () => {
    const { doc } = importVSCodeTheme(theme, { tolerance: 0, keepTokenRules: true });
    const view = new ThemeView(doc);
    expect(doc.extraTokens).toHaveLength(5);
    expect(view.tokenFor("string.url.js").fontStyle).toEqual(["underline"]);
    expect(view.tokenFor("string.url.js").color).toBe("#98c379");
  });

  it("handles token-only themes with no editor.foreground", () => {
    const { doc } = importVSCodeTheme(
      { type: "light", tokenColors: [{ scope: "string", settings: { foreground: "#a31515" } }] },
      { tolerance: 0, keepTokenRules: true },
    );
    const view = new ThemeView(doc);
    expect(view.token("string").color).toBe("#a31515");
    expect(view.token("keyword").color).toBe("#333333");
  });

  it("rejects files without colors", () => {
    expect(() => importVSCodeTheme({ name: "x" }, { tolerance: 0, keepTokenRules: true })).toThrow(/No colors/);
  });
});
