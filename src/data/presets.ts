import { hexToLch } from "../color/color";
import type { PaletteColor } from "../stores/types";

export interface LinkGroup {
  id: string;
  label: string;
  /** UI color for the group's chain indicator. */
  tint: string;
}

export const LINK_GROUPS: LinkGroup[] = [
  { id: "neutral", label: "Neutrals", tint: "#8b9bb4" },
  { id: "accent", label: "Accents", tint: "#e0a040" },
  { id: "extra", label: "Group 3", tint: "#4fc1a0" },
];

type Seed = [id: string, name: string, hex: string, group: string | null];

/** Palette ids are stable role names so color assignments survive preset swaps. */
const DARK: Seed[] = [
  ["bg", "Background", "#282c34", "neutral"],
  ["bgAlt", "Background Alt", "#21252b", "neutral"],
  ["bgHighlight", "Highlight", "#2c313c", "neutral"],
  ["border", "Border", "#181a1f", "neutral"],
  ["selection", "Selection", "#3e4451", "neutral"],
  ["fgMuted", "Muted Text", "#5c6370", "neutral"],
  ["fg", "Foreground", "#abb2bf", "neutral"],
  ["accent", "Accent", "#4d78cc", "accent"],
  ["red", "Red", "#e06c75", "accent"],
  ["orange", "Orange", "#d19a66", "accent"],
  ["yellow", "Yellow", "#e5c07b", "accent"],
  ["green", "Green", "#98c379", "accent"],
  ["cyan", "Cyan", "#56b6c2", "accent"],
  ["blue", "Blue", "#61afef", "accent"],
  ["purple", "Purple", "#c678dd", "accent"],
];

const LIGHT: Seed[] = [
  ["bg", "Background", "#fafafa", "neutral"],
  ["bgAlt", "Background Alt", "#eaeaeb", "neutral"],
  ["bgHighlight", "Highlight", "#f0f0f1", "neutral"],
  ["border", "Border", "#dbdbdc", "neutral"],
  ["selection", "Selection", "#e5e5e6", "neutral"],
  ["fgMuted", "Muted Text", "#a0a1a7", "neutral"],
  ["fg", "Foreground", "#383a42", "neutral"],
  ["accent", "Accent", "#526fff", "accent"],
  ["red", "Red", "#e45649", "accent"],
  ["orange", "Orange", "#986801", "accent"],
  ["yellow", "Yellow", "#c18401", "accent"],
  ["green", "Green", "#50a14f", "accent"],
  ["cyan", "Cyan", "#0184bc", "accent"],
  ["blue", "Blue", "#4078f2", "accent"],
  ["purple", "Purple", "#a626a4", "accent"],
];

export function presetPalette(type: "dark" | "light"): PaletteColor[] {
  return (type === "dark" ? DARK : LIGHT).map(([id, name, hex, group]) => ({
    id,
    name,
    group,
    ...hexToLch(hex)!,
  }));
}
