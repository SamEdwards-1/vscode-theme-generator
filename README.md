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
| `npm run build` | Type-check and build static files into `dist/` |
| `npm run preview` | Serve the production build locally |

## Deploy to Netlify

The app is fully static, and [`netlify.toml`](netlify.toml) holds the deploy settings: tests then `npm run build` on Node 22, publishing `dist/`, with long-lived caching for hashed assets and basic security headers. No environment variables are needed.

- **From Git**: in Netlify, *Add new site → Import an existing project*, pick this repo, and keep the detected settings.
- **From the CLI**: `npx netlify-cli deploy --build` for a draft URL, then add `--prod` to publish.

## Using it

- **Palette tab**: drag dots on the hue/chroma wheel or the lightness rail, or use the sliders. Colors in the same link group (chain icon) move together. *Boundary behavior* decides what happens when a follower hits 0 % or 100 %: **Clamp**, **Compress**, or **Rigid**. **Contrast guard** stops a drag before any passing text color drops below 4.5:1 (or the threshold you pick).
- **Colors / Syntax tabs**: assign each VS Code key or token group to a palette color, with an optional *lightness offset* (a derived color such as "Background +4 %") and opacity. Click any part of the preview to jump to its colors.
- **Import**: load an existing `*-color-theme.json` (comments and trailing commas are fine). Similar colors are merged into one palette entry plus lightness offsets. Set *Merge similar colors* to *Off* for an exact copy.
- **Export**: download an installable `.vsix`, then in VS Code run *Extensions: Install from VSIX…* (or `code --install-extension <file>.vsix`) and pick the theme under *Preferences: Color Theme*. You can also download just the theme `.json`.
- **Save project** keeps the editable palette, links and assignments. Re-open it with **Import**. Work is also auto-saved in the browser.

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
