import { describe, expect, it } from "vitest";
import { presetPalette } from "../data/presets";
import { defaultSyntax } from "../data/syntax";
import { defaultWorkbench } from "../data/workbench";
import { ThemeView, type ThemeInputs } from "./view";

function inputs(): ThemeInputs {
  const syntax = defaultSyntax();
  syntax.keyword = { source: "blue", alpha: 1, fontStyle: [] };
  return { type: "dark", palette: presetPalette("dark"), workbench: defaultWorkbench("dark"), syntax };
}

describe("preview token assignment", () => {
  it("selects the imported rule that supplies the displayed syntax color", () => {
    const doc = inputs();
    doc.extraTokens = [{ scope: ["keyword.control.flow.js"], color: { source: "red", alpha: 1 } }];
    const view = new ThemeView(doc);
    expect(view.token("keyword").color).toBe(view.paletteHex("red"));
    expect(view.tokenAssignment("keyword")?.source).toBe("red");
  });

  it("keeps the base color when an imported rule changes only font style", () => {
    const doc = inputs();
    doc.extraTokens = [{ scope: ["keyword.control.flow.js"], color: null, fontStyle: "bold" }];
    expect(new ThemeView(doc).tokenAssignment("keyword")?.source).toBe("blue");
  });

  it("honors specificity and later-rule precedence", () => {
    const doc = inputs();
    doc.extraTokens = [
      { scope: ["keyword.control.flow.js"], color: { source: "red", alpha: 1 } },
      { scope: ["keyword"], color: { source: "green", alpha: 1 } },
    ];
    expect(new ThemeView(doc).tokenAssignment("keyword")?.source).toBe("red");
    doc.extraTokens = [...doc.extraTokens, { scope: ["keyword.control.flow.js"], color: { source: "purple", alpha: 1 } }];
    expect(new ThemeView(doc).tokenAssignment("keyword")?.source).toBe("purple");
  });

  it("preserves assignment identity even when two palette colors look identical", () => {
    const doc = inputs();
    const blue = doc.palette.find((c) => c.id === "blue")!;
    doc.palette = doc.palette.map((c) => c.id === "red" ? { ...c, l: blue.l, c: blue.c, h: blue.h } : c);
    doc.extraTokens = [{ scope: ["keyword.control.flow.js"], color: { source: "red", alpha: 1 } }];
    const view = new ThemeView(doc);
    expect(view.paletteHex("red")).toBe(view.paletteHex("blue"));
    expect(view.tokenAssignment("keyword")?.source).toBe("red");
  });

  it("falls back to the editor foreground when no rule supplies a color", () => {
    const doc = inputs();
    doc.syntax = {};
    expect(new ThemeView(doc).tokenAssignment("keyword")?.source).toBe("fg");
  });
});
