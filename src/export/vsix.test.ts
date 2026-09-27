import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { buildVsix, validateMeta } from "./vsix";

const meta = { publisher: "sam", version: "1.2.3", description: "" };
const theme = { name: "Night & Day", type: "dark", colors: { "editor.background": "#101010" } };

describe("buildVsix", () => {
  const { filename, bytes } = buildVsix({ name: "Night & Day", type: "dark", themeJson: theme, meta });
  const files = unzipSync(bytes);
  const text = (p: string) => strFromU8(files[p]);

  it("uses the VS Code extension package layout", () => {
    expect(filename).toBe("night-day-1.2.3.vsix");
    expect(Object.keys(files).sort()).toEqual([
      "[Content_Types].xml",
      "extension.vsixmanifest",
      "extension/package.json",
      "extension/readme.md",
      "extension/themes/night-day-color-theme.json",
    ]);
  });

  it("contributes the theme from package.json", () => {
    const pkg = JSON.parse(text("extension/package.json"));
    expect(pkg).toMatchObject({ name: "night-day", publisher: "sam", version: "1.2.3" });
    expect(pkg.contributes.themes[0]).toEqual({
      label: "Night & Day",
      uiTheme: "vs-dark",
      path: "./themes/night-day-color-theme.json",
    });
    expect(JSON.parse(text("extension/themes/night-day-color-theme.json"))).toEqual(theme);
  });

  it("escapes XML in the manifest", () => {
    expect(text("extension.vsixmanifest")).toContain("<DisplayName>Night &amp; Day</DisplayName>");
    expect(text("extension.vsixmanifest")).toContain('Id="night-day" Version="1.2.3" Publisher="sam"');
  });
});

describe("validateMeta", () => {
  it("accepts good metadata and rejects bad publisher/version", () => {
    expect(validateMeta("X", meta)).toEqual([]);
    expect(validateMeta("X", { ...meta, publisher: "my name", version: "1.0" })).toHaveLength(2);
  });
});
