import { observer } from "mobx-react-lite";
import { store } from "../../stores/ThemeStore";
import type { ColorAssignment } from "../../stores/types";
import { GradientSlider } from "../../ui/GradientSlider";
import { HexInput } from "../../ui/HexInput";

interface Props {
  value: ColorAssignment;
  onChange: (a: ColorAssignment) => void;
}

const round = (v: number, step: number) => Math.round(v / step) * step;

/**
 * Inline picker: choose a palette color (linked) or a literal hex, then an
 * optional lightness offset (a derived color) and opacity.
 */
export const AssignmentEditor = observer(function AssignmentEditor({ value, onChange }: Props) {
  const isLiteral = value.source.startsWith("#");
  const base = isLiteral ? value.source : (store.hexById.get(value.source) ?? "#ff00ff");
  const dl = value.dl ?? 0;
  const derived = store.resolve({ ...value, alpha: 1 }) ?? base;
  const offsetTrack = `linear-gradient(to right, ${[-0.3, -0.15, 0, 0.15, 0.3]
    .map((d) => store.resolve({ source: value.source, alpha: 1, dl: d }))
    .join(", ")})`;

  const set = (patch: Partial<ColorAssignment>) => {
    const next = { ...value, ...patch };
    if (!next.dl) delete next.dl;
    onChange(next);
  };

  return (
    <div className="assign-editor" onClick={(e) => e.stopPropagation()}>
      <div className="chip-grid">
        {store.palette.map((c) => (
          <button
            key={c.id}
            className={"chip" + (c.id === value.source ? " active" : "")}
            style={{ background: store.hexById.get(c.id) }}
            title={c.name}
            onClick={() => set({ source: c.id })}
          />
        ))}
      </div>
      <div className="assign-fields">
        <label className="label">{isLiteral ? "Custom" : "Linked to"}</label>
        {isLiteral ? (
          <span className="muted">not tracking the palette</span>
        ) : (
          <span>{store.palette.find((c) => c.id === value.source)?.name ?? "missing"}</span>
        )}
        <HexInput value={base} onCommit={(hex) => set({ source: hex })} />
      </div>
      <GradientSlider
        label={dl ? `Lightness offset → ${derived}` : "Lightness offset"}
        value={dl}
        min={-0.3}
        max={0.3}
        step={0.01}
        track={offsetTrack}
        format={(v) => `${v > 0 ? "+" : ""}${Math.round(v * 100)}%`}
        onStart={store.beginBatch}
        onChange={(v) => set({ dl: Math.abs(v) < 0.005 ? 0 : round(v, 0.01) })}
        onEnd={store.endBatch}
      />
      <GradientSlider
        label="Opacity"
        value={value.alpha}
        min={0}
        max={1}
        step={0.01}
        track={`linear-gradient(to right, transparent, ${derived}), repeating-conic-gradient(#555 0 25%, #333 0 50%) 0 0 / 10px 10px`}
        format={(v) => `${Math.round(v * 100)}%`}
        onStart={store.beginBatch}
        onChange={(alpha) => set({ alpha: round(alpha, 0.01) })}
        onEnd={store.endBatch}
      />
    </div>
  );
});

/** Short human description of an assignment, e.g. "Background +4% · 60%". */
export function describe(a: ColorAssignment): string {
  const name = a.source.startsWith("#")
    ? a.source
    : (store.palette.find((c) => c.id === a.source)?.name ?? `missing: ${a.source}`);
  const dl = a.dl ? ` ${a.dl > 0 ? "+" : ""}${Math.round(a.dl * 100)}%` : "";
  const alpha = a.alpha < 1 ? ` · ${Math.round(a.alpha * 100)}%` : "";
  return name + dl + alpha;
}
