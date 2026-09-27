import type { FontStyle, SyntaxAssignment } from "../stores/types";

export interface SyntaxGroup {
  id: string;
  label: string;
  scopes: string[];
  /** A concrete scope used to ask "what color does this group render as?". */
  probe: string;
  defaultAssignment: SyntaxAssignment;
}

const def = (source: string, fontStyle: FontStyle[] = []): SyntaxAssignment => ({
  source,
  alpha: 1,
  fontStyle,
});

export const SYNTAX_GROUPS: SyntaxGroup[] = [
  {
    id: "comment",
    probe: "comment.line.double-slash.js",
    label: "Comments",
    scopes: ["comment", "punctuation.definition.comment", "string.comment"],
    defaultAssignment: def("fgMuted", ["italic"]),
  },
  {
    id: "keyword",
    probe: "keyword.control.flow.js",
    label: "Keywords, storage",
    scopes: ["keyword", "storage.type", "storage.modifier", "keyword.control", "variable.language.this"],
    defaultAssignment: def("purple"),
  },
  {
    id: "variable",
    probe: "variable.other.readwrite.js",
    label: "Variables, properties",
    scopes: [
      "variable",
      "variable.other.property",
      "variable.other.object.property",
      "meta.object-literal.key",
      "support.type.property-name",
      "entity.name.tag",
    ],
    defaultAssignment: def("red"),
  },
  {
    id: "number",
    probe: "constant.numeric.decimal.js",
    label: "Numbers",
    scopes: ["constant.numeric", "keyword.other.unit", "entity.other.attribute-name"],
    defaultAssignment: def("orange"),
  },
  {
    id: "type",
    probe: "entity.name.type.class.js",
    label: "Classes, types, constants",
    scopes: [
      "entity.name.type",
      "entity.name.class",
      "support.class",
      "support.type",
      "constant.language",
      "variable.other.constant",
    ],
    defaultAssignment: def("yellow"),
  },
  {
    id: "function",
    probe: "entity.name.function.js",
    label: "Functions, methods",
    scopes: ["entity.name.function", "support.function", "meta.function-call", "variable.function"],
    defaultAssignment: def("blue"),
  },
  {
    id: "string",
    probe: "string.quoted.double.js",
    label: "Strings",
    scopes: ["string", "punctuation.definition.string", "markup.inline.raw"],
    defaultAssignment: def("green"),
  },
  {
    id: "operator",
    probe: "keyword.operator.arithmetic.js",
    label: "Operators, escapes, regex",
    scopes: ["keyword.operator", "constant.character.escape", "string.regexp", "support.constant"],
    defaultAssignment: def("cyan"),
  },
  {
    id: "parameter",
    probe: "variable.parameter.js",
    label: "Parameters",
    scopes: ["variable.parameter"],
    defaultAssignment: def("fg", ["italic"]),
  },
  {
    id: "punctuation",
    probe: "punctuation.separator.comma.js",
    label: "Punctuation",
    scopes: ["punctuation", "meta.brace", "meta.delimiter"],
    defaultAssignment: def("fg"),
  },
];

export function defaultSyntax(): Record<string, SyntaxAssignment> {
  return Object.fromEntries(
    SYNTAX_GROUPS.map((g) => [g.id, { ...g.defaultAssignment, fontStyle: [...g.defaultAssignment.fontStyle] }]),
  );
}
