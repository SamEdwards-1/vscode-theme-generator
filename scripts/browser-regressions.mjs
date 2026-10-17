import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Uses gstack's own browser, as required by this repository. No browser dependency
// or user browser profile is needed; all edits stay in this isolated local tab.
const name = process.platform === "win32" ? "browse.exe" : "browse";
const roots = [process.env.GSTACK_ROOT, ...[".Codex", ".codex", ".agents"].map((dir) => join(homedir(), dir, "skills", "gstack"))];
const browser = process.env.GSTACK_BROWSE_BIN ?? roots.filter(Boolean).map((root) => join(root, "browse", "dist", name)).find(existsSync);
assert.ok(browser, "Install gstack or set GSTACK_BROWSE_BIN to its browse executable.");
const url = process.argv[2] ?? "http://127.0.0.1:5184/";
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname), "Run browser regressions against a local dev server only.");
const run = (...args) => execFileSync(browser, args, { encoding: "utf8", timeout: 30000 }).trim();
const state = (expression) => JSON.parse(run("js", `(async () => ({ value: await (${expression}) }))()`.replace(/\r?\n/g, " "))).value;
// Reuse Vite's exact HMR URLs so the fixture and app share one store instance.
const fixture = (body) => state(`(async () => {
  const loaded = (path) => {
    const entry = performance.getEntriesByType('resource').find((e) => new URL(e.name).pathname === path);
    if (!entry) throw new Error('App module not loaded: ' + path);
    return entry.name;
  };
  const {store}=await import(loaded('/src/stores/ThemeStore.ts'));
  const {ui}=await import(loaded('/src/stores/UiStore.ts'));
  ${body}
})()`);
let opened = false;
try {
  run("newtab", url);
  opened = true;
  run("viewport", "1440x900");
  fixture("store.newTheme('dark'); ui.setTab('palette'); return true;");
  run("click", ".anchor-swatch");
  run("fill", ".te-picker .te-hex", "#123456");
  run("click", ".brand");
  assert.equal(state("document.querySelector('.anchor-head .hex-input').value"), "#123456", "Clicking outside must commit typed hex before the picker unmounts.");
  run("press", "Control+z");
  assert.equal(state("document.querySelector('.anchor-head .hex-input').value"), "#4d78cc", "One Undo must restore the color from before hex entry.");
  console.log("PASS: outside-close hex commit and one-step Undo");

  run("click", '.slider .scrub-number[aria-label^="Hue:"]');
  run("fill", ".scrub-input", "180");
  run("press", "Enter");
  assert.equal(state("document.querySelector('.slider .scrub-number[aria-label^=Hue]').textContent"), "180°");
  run("click", '.slider .scrub-number[aria-label^="Hue:"]');
  run("fill", ".scrub-input", "45");
  run("press", "Escape");
  assert.equal(state("document.querySelector('.slider .scrub-number[aria-label^=Hue]').textContent"), "180°", "Escape must discard numeric input.");
  console.log("PASS: numeric typing and Escape cancellation");

  fixture(`store.newTheme('dark'); const doc=store.document; const blue=doc.palette.find(c=>c.id==='blue');
    doc.palette=doc.palette.map(c=>c.id==='red'?{...c,l:blue.l,c:blue.c,h:blue.h}:c);
    doc.syntax.keyword={source:'blue',alpha:1,fontStyle:[]};
    doc.extraTokens=[{scope:['keyword.control.flow.js'],color:{source:'red',alpha:1}}];
    store.importDocument(doc);ui.setPickColors(true);return true;`);
  run("click", '.pv-line:nth-child(2) .pv-text > span[style*="--preview-syntax_keyword"]:first-child');
  assert.equal(fixture("return store.selectedId;"), "red", "Picking syntax must select the winning imported rule even when its color equals another palette entry.");
  console.log("PASS: imported syntax picking preserves color identity");
  assert.equal(state("document.querySelectorAll('.wheel-link').length"), 10);
  console.log("PASS: linked groups remain visible with a singleton anchor");
} finally {
  if (opened) run("closetab");
}
