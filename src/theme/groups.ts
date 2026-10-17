import type { PaletteColor, ThemeDocument } from "../stores/types";

/** Classify by use, keeping status and text independent of the accent. */
export function roleGroups(doc: ThemeDocument): PaletteColor[] {
  return doc.palette.map((color) => {
    const uses = Object.entries(doc.workbench).filter(([, a]) => a?.source === color.id);
    const syntax = Object.values(doc.syntax).some((a) => a.source === color.id)
      || doc.extraTokens?.some((a) => a.color?.source === color.id);
    const opaque = uses.some(([, a]) => a!.alpha > 0.5) || syntax;
    const keys = uses.filter(([, a]) => a!.alpha > 0.5).map(([key]) => key);
    let group: string | null = "accent";
    if (color.l <= 0.001 || color.l >= 0.999 || (!opaque && uses.length > 0)) group = null;
    else if (keys.some((k) => /error|warning|invalid|deleted|added|modified|untracked|conflict/i.test(k))) group = "status";
    else if (keys.some((k) => /foreground|^foreground$/.test(k))) group = "text";
    else if (keys.some((k) => /background|border|shadow/i.test(k)) && color.c < 0.06) group = "surface";
    else if (syntax) group = "syntax";
    else if (keys.some((k) => /background|border|shadow/i.test(k))) group = "surface";
    if (color.id === "accent") group = "accent";
    return { ...color, group, linkedGroup: group ?? color.linkedGroup };
  });
}
