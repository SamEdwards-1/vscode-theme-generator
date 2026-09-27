/** Token kinds match syntax group ids; "plain" uses editor.foreground. */
export type TokenKind =
  | "comment"
  | "keyword"
  | "variable"
  | "number"
  | "type"
  | "function"
  | "string"
  | "operator"
  | "parameter"
  | "punctuation"
  | "plain";

export interface Token {
  text: string;
  kind: TokenKind;
}

const KEYWORDS = new Set([
  "import", "from", "export", "const", "let", "var", "class", "async", "await",
  "return", "if", "else", "for", "while", "try", "catch", "new", "this", "of",
  "in", "function", "throw", "extends", "static", "default",
]);
const CONSTANTS = new Set(["true", "false", "null", "undefined"]);
const CONTROL = new Set(["if", "for", "while", "catch", "switch", "return"]);

const RULES: [RegExp, TokenKind | "ident" | "ws"][] = [
  [/^\/\/.*/, "comment"],
  [/^"(?:\\.|[^"\\])*"|^'(?:\\.|[^'\\])*'|^`(?:\\.|[^`\\])*`/, "string"],
  [/^\d[\d_]*(?:\.\d+)?/, "number"],
  [/^[A-Za-z_$][\w$]*/, "ident"],
  [/^(?:=>|===|!==|==|!=|<=|>=|\+\+|--|&&|\|\||[=<>+\-*/%?!:])/, "operator"],
  [/^[{}()[\];,.]/, "punctuation"],
  [/^\s+/, "ws"],
];

/**
 * A deliberately small JS highlighter for the preview. Parameters are
 * recognised only on single-line method definitions and catch clauses.
 */
export function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  let rest = line;
  while (rest.length) {
    let matched = false;
    for (const [re, kind] of RULES) {
      const m = re.exec(rest);
      if (!m) continue;
      const text = m[0];
      rest = rest.slice(text.length);
      matched = true;
      if (kind === "ws") tokens.push({ text, kind: "plain" });
      else if (kind === "ident") tokens.push({ text, kind: classifyIdent(text, tokens, rest) });
      else tokens.push({ text, kind });
      break;
    }
    if (!matched) {
      tokens.push({ text: rest[0], kind: "plain" });
      rest = rest.slice(1);
    }
  }
  markParameters(tokens);
  return tokens;
}

function prevSignificant(tokens: Token[]): Token | undefined {
  for (let i = tokens.length - 1; i >= 0; i--) if (tokens[i].text.trim()) return tokens[i];
  return undefined;
}

function classifyIdent(text: string, before: Token[], after: string): TokenKind {
  if (CONSTANTS.has(text)) return "type";
  if (KEYWORDS.has(text)) return "keyword";
  if (/^[A-Z][A-Z0-9_]+$/.test(text)) return "type";
  if (/^[A-Z]/.test(text)) return "type";
  if (/^\s*\(/.test(after)) return "function";
  if (prevSignificant(before)?.text === ".") return "variable";
  return "variable";
}

/** Marks identifiers inside the parameter list of `name(...) {` and `catch (x)`. */
function markParameters(tokens: Token[]) {
  const sig = tokens.filter((t) => t.text.trim());
  const first = sig[0]?.text === "async" ? sig[1] : sig[0];
  const isDefinition =
    first &&
    ((first.kind === "function" && !CONTROL.has(first.text) && sig[sig.length - 1]?.text === "{") ||
      first.text === "catch" ||
      (first.text === "}" && sig[1]?.text === "catch"));
  if (!isDefinition) return;

  let depth = 0;
  let afterEquals = false;
  for (const t of tokens) {
    if (t.text === "(") depth++;
    else if (t.text === ")") {
      depth--;
      if (depth === 0) return;
    } else if (depth > 0) {
      if (t.text === "=") afterEquals = true;
      else if (t.text === "," || t.text === "}") afterEquals = false;
      else if (t.kind === "variable" && !afterEquals) t.kind = "parameter";
    }
  }
}
