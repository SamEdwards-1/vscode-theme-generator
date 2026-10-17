import { C_MAX, isHex } from "../color/color";
import type { ColorAssignment, ThemeDocument } from "../stores/types";

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const finite = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const safeKey = (key: string) => !["__proto__", "prototype", "constructor"].includes(key);

/** Validate projects from files, storage and generated replies before using them. */
export function parseProject(value: unknown): ThemeDocument {
  if (!record(value) || value.version !== 1 || !["dark", "light"].includes(String(value.type))
    || typeof value.name !== "string" || !Array.isArray(value.palette) || !value.palette.length || value.palette.length > 2000) {
    throw new Error("Invalid Theme Generator project: expected a version 1 palette, name and dark/light type.");
  }
  const ids = new Set<string>();
  for (const c of value.palette) {
    if (!record(c) || typeof c.id !== "string" || !c.id || !safeKey(c.id) || ids.has(c.id)
      || typeof c.name !== "string" || !(c.group === null || typeof c.group === "string")
      || !finite(c.l, 0, 1) || !finite(c.c, 0, C_MAX) || !finite(c.h, 0, 360)
      || (c.linkedGroup !== undefined && typeof c.linkedGroup !== "string")
      || (c.original !== undefined && (!record(c.original) || !finite(c.original.l, 0, 1)
        || !finite(c.original.c, 0, C_MAX) || !finite(c.original.h, 0, 360)))) throw new Error("Invalid palette color or duplicate color id.");
    ids.add(c.id);
  }
  const assignment = (v: unknown): v is ColorAssignment => record(v) && typeof v.source === "string"
    && (ids.has(v.source) || isHex(v.source)) && finite(v.alpha, 0, 1)
    && (v.dl === undefined || finite(v.dl, -1, 1));
  if (!record(value.workbench) || !record(value.syntax)) throw new Error("Missing color assignments.");
  for (const [key, a] of Object.entries(value.workbench)) {
    if (!safeKey(key) || (a !== null && !assignment(a))) throw new Error(`Invalid assignment: ${key}`);
  }
  for (const [key, a] of Object.entries(value.syntax)) {
    if (!safeKey(key) || !assignment(a) || !record(a) || !Array.isArray(a.fontStyle)
      || a.fontStyle.some((s) => !["italic", "bold", "underline"].includes(String(s)))) throw new Error(`Invalid syntax assignment: ${key}`);
  }
  if (value.extraTokens !== undefined && (!Array.isArray(value.extraTokens) || value.extraTokens.some((r) => !record(r)
    || !Array.isArray(r.scope) || r.scope.some((s) => typeof s !== "string")
    || (r.name !== undefined && typeof r.name !== "string") || (r.fontStyle !== undefined && typeof r.fontStyle !== "string")
    || (r.color !== null && !assignment(r.color))))) throw new Error("Invalid imported token rules.");
  const meta = value.meta;
  if (meta !== undefined && (!record(meta) || ["publisher", "version", "description"].some((k) => typeof meta[k] !== "string"))) throw new Error("Invalid extension details.");
  return structuredClone(value) as unknown as ThemeDocument;
}
