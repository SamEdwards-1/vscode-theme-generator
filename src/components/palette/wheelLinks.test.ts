import { describe, expect, it } from "vitest";
import { presetPalette } from "../../data/presets";
import { wheelLinks } from "./wheelLinks";

describe("wheel link overview", () => {
  it("shows other linked groups when the selected accent has no followers", () => {
    const links = wheelLinks(presetPalette("dark"), "accent", false);
    expect(links).toHaveLength(10);
    expect(new Set(links.map((link) => link.from.group))).toEqual(new Set(["surface", "text", "syntax"]));
    expect(links.every((link) => link.from.group === link.to.group)).toBe(true);
    expect(links.some((link) => link.from.id === "accent" || link.to.id === "accent")).toBe(false);
  });

  it("highlights the selected group's links while retaining the others", () => {
    const links = wheelLinks(presetPalette("light"), "green", false);
    expect(links).toHaveLength(10);
    const active = links.filter((link) => link.active);
    expect(active).toHaveLength(5);
    expect(active.every((link) => link.from.id === "green")).toBe(true);
  });

  it("never draws a connection to an unlinked entry", () => {
    const palette = presetPalette("dark");
    palette.find((c) => c.id === "green")!.group = null;
    const links = wheelLinks(palette, "green", false);
    expect(links).toHaveLength(9);
    expect(links.every((link) => link.from.id !== "green" && link.to.id !== "green" && !link.active)).toBe(true);
  });

  it("shows the same cross-group followers as an edit", () => {
    const links = wheelLinks(presetPalette("dark"), "accent", true);
    expect(links).toHaveLength(14);
    expect(links.every((link) => link.from.id === "accent" && link.active)).toBe(true);
  });

  it("handles empty palettes, single colors and custom group names", () => {
    expect(wheelLinks([], null, false)).toEqual([]);
    const palette = presetPalette("dark").slice(0, 2).map((c) => ({ ...c, group: "My group" }));
    expect(wheelLinks(palette.slice(0, 1), null, false)).toEqual([]);
    expect(wheelLinks(palette, null, false)).toHaveLength(1);
  });
});
