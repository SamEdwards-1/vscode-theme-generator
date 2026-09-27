import { describe, expect, it } from "vitest";
import {
  applyAnchorEdit,
  applyGlobalAdjust,
  followerIds,
  shiftAxis,
  type RelationalColor,
} from "./relational";

const palette: RelationalColor[] = [
  { id: "primary", l: 0.6, c: 0.18, h: 250, group: "a" },
  { id: "secondary", l: 0.75, c: 0.14, h: 180, group: "a" },
  { id: "accent", l: 0.85, c: 0.22, h: 90, group: "a" },
  { id: "bg", l: 0.2, c: 0.02, h: 250, group: "b" },
  { id: "loose", l: 0.5, c: 0.1, h: 10, group: null },
];

const byId = (colors: RelationalColor[], id: string) =>
  colors.find((c) => c.id === id)!;

describe("followerIds", () => {
  it("follows only the anchor's group by default", () => {
    expect(followerIds(palette, "primary", false)).toEqual(["secondary", "accent"]);
  });
  it("follows every linked color when crossGroup is on", () => {
    expect(followerIds(palette, "primary", true)).toEqual(["secondary", "accent", "bg"]);
  });
  it("has no followers for an unlinked anchor", () => {
    expect(followerIds(palette, "loose", true)).toEqual([]);
  });
});

describe("applyAnchorEdit", () => {
  it("shifts followers by the anchor's delta (plan example)", () => {
    const { colors, limited } = applyAnchorEdit(
      palette,
      "primary",
      { l: 0.75, h: 260 },
      { mode: "clamp", crossGroup: false },
    );
    expect(byId(colors, "primary")).toMatchObject({ l: 0.75, h: 260 });
    expect(byId(colors, "secondary").l).toBeCloseTo(0.9);
    expect(byId(colors, "secondary").h).toBeCloseTo(190);
    expect(byId(colors, "accent").l).toBeCloseTo(1); // 1.0 exactly: not clipped
    expect(byId(colors, "accent").h).toBeCloseTo(100);
    expect(byId(colors, "bg")).toEqual(palette[3]); // other group untouched
    expect(limited).toEqual([]);
  });

  it("clamps and reports clipped followers in clamp mode", () => {
    const { colors, limited } = applyAnchorEdit(
      palette,
      "primary",
      { l: 0.8 },
      { mode: "clamp", crossGroup: false },
    );
    expect(byId(colors, "accent").l).toBe(1);
    expect(limited).toEqual(["accent"]);
  });

  it("takes the short way around the hue circle", () => {
    const { colors } = applyAnchorEdit(
      [
        { id: "x", l: 0.5, c: 0.1, h: 350, group: "a" },
        { id: "y", l: 0.5, c: 0.1, h: 100, group: "a" },
      ],
      "x",
      { h: 10 },
      { mode: "clamp", crossGroup: false },
    );
    expect(byId(colors, "y").h).toBeCloseTo(120);
  });

  it("stops the whole set together in preserve mode", () => {
    const { colors, limited } = applyAnchorEdit(
      palette,
      "primary",
      { l: 0.9 },
      { mode: "preserve", crossGroup: false },
    );
    // accent had 0.15 headroom, so both followers move +0.15 and keep their gap.
    expect(byId(colors, "accent").l).toBeCloseTo(1);
    expect(byId(colors, "secondary").l).toBeCloseTo(0.9);
    expect(limited.sort()).toEqual(["accent", "secondary"]);
  });

  it("compresses near the edge in proportional mode without flattening", () => {
    const { colors } = applyAnchorEdit(
      palette,
      "primary",
      { l: 0.8 },
      { mode: "proportional", crossGroup: false },
    );
    const s = byId(colors, "secondary").l;
    const a = byId(colors, "accent").l;
    expect(a).toBeLessThan(1);
    expect(s).toBeLessThan(a); // ordering preserved
  });

  it("measures from the snapshot so repeated updates do not accumulate", () => {
    const opts = { mode: "clamp" as const, crossGroup: false };
    applyAnchorEdit(palette, "primary", { l: 0.9 }, opts);
    const { colors } = applyAnchorEdit(palette, "primary", { l: 0.6 }, opts);
    expect(byId(colors, "accent").l).toBeCloseTo(0.85);
  });
});

describe("shiftAxis", () => {
  it("is a no-op for zero delta", () => {
    expect(shiftAxis([0.2, 0.9], 0, 0.5, 1, "clamp").values).toEqual([0.2, 0.9]);
  });
});

describe("applyGlobalAdjust", () => {
  it("rotates hue, scales chroma and offsets lightness for targets only", () => {
    const { colors } = applyGlobalAdjust(
      palette,
      ["primary", "bg"],
      { hueShift: 20, chromaScale: 0.5, lightOffset: 0.1 },
      "clamp",
    );
    expect(byId(colors, "primary")).toMatchObject({ h: 270 });
    expect(byId(colors, "primary").c).toBeCloseTo(0.09);
    expect(byId(colors, "primary").l).toBeCloseTo(0.7);
    expect(byId(colors, "bg").h).toBeCloseTo(270);
    expect(byId(colors, "secondary")).toEqual(palette[1]);
  });
});
