import { describe, expect, it } from "vitest";
import { presetPalette } from "../data/presets";
import { defaultWorkbench } from "../data/workbench";
import { defaultSyntax } from "../data/syntax";
import { importVSCodeTheme } from "./importTheme";
import { parseProject } from "./project";
import ocean from "./fixtures/ocean.json?raw";

const project = () => ({ version: 1, name: "Example", type: "dark", palette: presetPalette("dark"), workbench: defaultWorkbench("dark"), syntax: defaultSyntax() });

describe("project JSON loading", () => {
  it("accepts current and legacy projects", () => {
    const doc = project();
    for (const c of doc.palette) delete c.original;
    expect(parseProject(JSON.parse(JSON.stringify(doc)))).toEqual(doc);
  });

  it("loads a VS Code JSON theme with its name and exact colors", () => {
    const result = importVSCodeTheme(JSON.parse(ocean), { tolerance: 0, keepTokenRules: true });
    const doc = parseProject(result.doc);
    expect(doc.name).toBe("Ocean");
    expect(doc.type).toBe("dark");
    expect(doc.extraTokens?.[0].scope).toEqual(["string"]);
    expect(doc.palette.find((c) => c.id === "fg")!.group).toBe("text");
    expect(doc.palette.find((c) => c.id === "bg")!.group).toBe("surface");
  });

  it("rejects duplicate ids, missing references and invalid alpha", () => {
    const duplicate = project();
    duplicate.palette.push(duplicate.palette[0]);
    expect(() => parseProject(duplicate)).toThrow("duplicate");
    const missing = project();
    missing.workbench["editor.background"] = { source: "missing", alpha: 1 };
    expect(() => parseProject(missing)).toThrow("Invalid assignment");
    missing.workbench["editor.background"] = { source: "bg", alpha: 2 };
    expect(() => parseProject(missing)).toThrow("Invalid assignment");
  });
});
