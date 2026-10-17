# Theme Generator for VS Code

Design VS Code color themes from a small, **relational palette**: drag one color and its linked colors follow, keeping their contrast and hue relationships (OKLCH offsets). Every VS Code UI color and syntax token points at a palette color, so palette edits flow through the whole theme.

## Run it

Requires [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm start
```

`npm start` runs the dev server and opens http://localhost:5173 in your browser. (`npm run dev` does the same without opening a tab.)

Other scripts:

| Command | What it does |
| --- | --- |
| `npm test` | Unit tests (color engine, store, importer, .vsix packaging) |
| `npm run test:browser -- http://127.0.0.1:5184/` | Browser regressions with gstack and a running dev server |
| `npm run build` | Type-check and build static files into `dist/` |
| `npm run preview` | Serve the production build locally |

## Deploy to Netlify

The app is fully static, and [`netlify.toml`](netlify.toml) holds the deploy settings: tests then `npm run build` on Node 22, publishing `dist/`, with long-lived caching for hashed assets and basic security headers. No environment variables are needed.

- **From Git**: in Netlify, *Add new site → Import an existing project*, pick this repo, and keep the detected settings.
- **From the CLI**: `npx netlify-cli deploy --build` for a draft URL, then add `--prod` to publish.

## Using it

- **Palette tab**: drag dots on the hue/chroma wheel or the lightness rail, or use the sliders. Click a swatch to open the OKLCH picker: **L × C** edits lightness/chroma at a fixed hue; **H × C** edits hue/chroma at a fixed lightness. Hatching marks colors outside sRGB. The picker includes hex entry, a before/after sample (click the original to restore the opening palette), and a screen eyedropper in supported Chromium browsers. Click a numeric readout to type, or drag it up/down to adjust; each drag is one Undo step.
- **Links and reset**: the chain button unlinks a color and relinks it to its previous group. Choose its group below the palette. **Reset** restores just that color to its original value. Surfaces, text, accent, syntax and status start in separate groups; **Group by role** regroups older or imported themes, leaving black, white and translucent-only overlays unlinked. Existing projects retain their groups until you regroup them. *Boundary behavior* decides what happens when a follower hits 0 % or 100 %: **Clamp**, **Compress**, or **Rigid**. **Contrast guard** stops a drag before any passing text color drops below 4.5:1 (or the threshold you pick).
- **Wheel guides**: dashed lines connect colors in each linked palette group. The selected color's group is emphasized, and hovering a dot shows its name and where it is used.
- **Colors / Syntax tabs**: assign each VS Code key or token group to a palette color, with an optional *lightness offset* (a derived color such as "Background +4 %") and opacity. Click any part of the preview to jump to its colors.
- **Pick colors from preview**: enable the checkbox above the preview, then click text, an edge or a fill to select its palette color. The inspection card lets you switch between the text, border and fill tokens, including tokens that happen to share the same color. Literal colors and VS Code defaults are identified in the card. Drag the divider between the editor and preview to resize the pane; the wheel stays visible while the editor scrolls.
- **Import**: start from any existing `*-color-theme.json` using **Choose file**, drag-and-drop or pasted JSON (comments and trailing commas are fine). Its name, dark/light type, UI colors and syntax rules become the editable draft. Similar colors are merged into one palette entry plus lightness offsets. Set *Merge similar colors* to *Off* for an exact copy. Editable project JSON is also accepted and validated before replacing the draft. Undo restores the previous theme.
- **Export**: download an installable `.vsix`, then in VS Code run *Extensions: Install from VSIX…* (or `code --install-extension <file>.vsix`) and pick the theme under *Preferences: Color Theme*. You can also download just the theme `.json`.
- **Save project** keeps the editable palette, links and assignments. Re-open it with **Import**. Work is also auto-saved in the browser.

## Social preview

The public app includes a 1200 × 630 Open Graph image for link sharing, including LinkedIn. The image and its screenshot source are maintained with the [social preview artwork instructions](scripts/README.md).

## Project layout

```
src/
  engine/relational.ts   anchor/follower math and boundary modes
  theme/view.ts          resolves palette + assignments into colors (derived offsets, VS Code defaults)
  theme/guard.ts         contrast pairs and the drag guard
  theme/tokens.ts        TextMate scope matching
  import/                JSONC parsing and theme → palette clustering
  export/vsix.ts         .vsix packaging
  stores/                MobX stores (document, undo, UI state)
  components/            React UI (palette, colors, syntax, preview, dialogs)
```
