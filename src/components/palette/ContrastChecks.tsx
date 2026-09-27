import { observer } from "mobx-react-lite";
import { composite, contrastGrade } from "../../color/color";
import { store } from "../../stores/ThemeStore";
import { CONTRAST_PAIRS, pairRatio } from "../../theme/guard";
import { LockIcon } from "../../ui/icons";

function Badge({ ratio }: { ratio: number }) {
  const grade = contrastGrade(ratio);
  return (
    <span className={`grade grade-${grade}`} title="WCAG 2 contrast. AA needs 4.5:1 for body text, 3:1 for large text/UI.">
      {ratio.toFixed(1)} {grade === "AA18" ? "AA large" : grade}
    </span>
  );
}

/** Live WCAG readouts for the pairs most likely to break while editing. */
export const ContrastChecks = observer(function ContrastChecks() {
  const view = store.view;
  const editorBg = view.color("editor.background") ?? "#000000";
  const guarded = (g: boolean, ratio: number) =>
    g && store.guardEnabled && ratio >= store.guardThreshold ? (
      <span className="lock" title={`Contrast guard keeps this at ${store.guardThreshold}:1 or better while dragging`}>
        <LockIcon />
      </span>
    ) : null;

  return (
    <section className="section">
      <div className="section-title">Contrast</div>
      <div className="contrast-list">
        {CONTRAST_PAIRS.filter((p) => !p.fg.startsWith("syntax:")).map((p) => {
          const bgRaw = view.color(p.bg);
          const fg = view.color(p.fg);
          const ratio = pairRatio(view, p);
          if (!fg || !bgRaw || ratio === null) return null;
          const bg = composite(bgRaw, editorBg);
          return (
            <div key={p.id} className="contrast-row">
              <span className="contrast-sample" style={{ background: bg, color: composite(fg, bg) }}>
                Aa
              </span>
              <span>
                {p.label} {guarded(p.guarded, ratio)}
              </span>
              <Badge ratio={ratio} />
            </div>
          );
        })}
      </div>
      <div className="section-subtitle">Syntax on editor background</div>
      <div className="contrast-chips">
        {CONTRAST_PAIRS.filter((p) => p.fg.startsWith("syntax:")).map((p) => {
          const fg = view.token(p.fg.slice(7)).color;
          const ratio = pairRatio(view, p) ?? 0;
          return (
            <span
              key={p.id}
              className={`contrast-chip grade-${contrastGrade(ratio)}`}
              style={{ background: editorBg, color: composite(fg, editorBg) }}
              title={`${p.label}: ${ratio.toFixed(2)}:1`}
            >
              {p.label.split(",")[0]} <b>{ratio.toFixed(1)}</b>
            </span>
          );
        })}
      </div>
    </section>
  );
});
