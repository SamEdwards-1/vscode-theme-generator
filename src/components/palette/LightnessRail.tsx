import { observer } from "mobx-react-lite";
import { useRef } from "react";
import { clamp } from "../../color/color";
import { store } from "../../stores/ThemeStore";
import { useWindowDrag } from "../../ui/useWindowDrag";

const HEIGHT = 248;
const PAD = 10;
const WIDTH = 54;
const LANES = 3;

/** Vertical lightness axis; dragging a dot changes L and moves linked colors. */
export const LightnessRail = observer(function LightnessRail() {
  const railRef = useRef<HTMLDivElement>(null);
  const dragId = useRef<string | null>(null);

  const drag = useWindowDrag({
    onStart: () => dragId.current && store.beginEdit(dragId.current),
    onMove: (e) => {
      if (!dragId.current) return;
      const r = railRef.current!.getBoundingClientRect();
      const l = 1 - clamp((e.clientY - r.top - PAD) / (r.height - PAD * 2), 0, 1);
      store.updateAnchor({ l });
    },
    onEnd: () => {
      dragId.current = null;
      store.endEdit();
    },
  });

  const anchorId = store.activeAnchorId ?? store.selectedId;
  const followers = store.linkedToAnchor;
  const limited = new Set(store.limited);
  // Spread dots across lanes (by lightness rank) so near-equal values stay grabbable.
  const lane = new Map(
    [...store.palette].sort((a, b) => a.l - b.l).map((c, i) => [c.id, i % LANES]),
  );

  return (
    <div className="rail" ref={railRef} style={{ height: HEIGHT, width: WIDTH }} title="Lightness (OKLCH L)">
      <div className="rail-track" style={{ top: PAD, bottom: PAD }} />
      {store.palette.map((c) => {
        const top = PAD + (1 - c.l) * (HEIGHT - PAD * 2);
        const left = 10 + lane.get(c.id)! * 14;
        const isAnchor = c.id === anchorId;
        return (
          <div
            key={c.id}
            className={
              "rail-dot" +
              (isAnchor ? " anchor" : "") +
              (followers.has(c.id) ? " follower" : "") +
              (limited.has(c.id) ? " limited" : "")
            }
            style={{ top, left, background: store.hexById.get(c.id) }}
            title={`${c.name} · L ${(c.l * 100).toFixed(0)}%`}
            onPointerDown={(e) => {
              dragId.current = c.id;
              drag(e);
            }}
          />
        );
      })}
    </div>
  );
});
