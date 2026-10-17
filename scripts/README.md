# Social preview artwork

`public/social-preview.png` is the 1200 × 630 Open Graph image used when the public app is shared, including on LinkedIn. `index.html` points to its absolute URL on `https://themepunch.netlify.app/` and includes descriptive alt text.

To refresh the image:

1. Start the app with `npm run dev` and open it in a browser at a 1440 × 900 viewport.
2. Use the dark preset, select Green so its linked colors are highlighted, and scroll the palette pane to the top. Keep the editor and preview visible. For this marketing capture, hide the demo notification with a temporary browser style `.pv-toast { display: none; }`; do not change the app source.
3. Capture the viewport to `scripts/assets/theme-builder.png`. This is a screenshot of the actual app, kept as the source image for the artwork.
4. Open `/scripts/social-preview.html` on the dev server, set the viewport to 1200 × 630, wait for the screenshot and fonts to load, then capture the viewport to `public/social-preview.png`.
5. Inspect the result, run `npm run build`, and verify that `dist/social-preview.png` and the Open Graph tags are present in the built site.

The artwork uses system fonts and local assets only. Changes to the canonical production hostname must also update the absolute sharing URLs in `index.html` and the address in the artwork.

## Browser regression checks

With the dev server running, use `npm run test:browser -- http://127.0.0.1:5184/`. This drives gstack's isolated browser tab to verify picker commit/undo, numeric entry/cancellation, imported syntax picking with equal palette colors, and wheel links. Set `GSTACK_BROWSE_BIN` if gstack is installed outside the standard skill folders. The runner accepts local URLs only and closes its own tab on completion.
