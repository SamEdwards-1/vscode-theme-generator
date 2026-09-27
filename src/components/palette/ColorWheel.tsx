import { observer } from "mobx-react-lite";
import { useRef } from "react";
import { wrapHue } from "../../color/color";
import { LINK_GROUPS } from "../../data/presets";
import { store } from "../../stores/ThemeStore";
import { useWindowDrag } from "../../ui/useWindowDrag";

const SIZE = 248;
const PAD = 14;
const R = SIZE / 2 - PAD;
const CX = SIZE / 2;
const CY = SIZE / 2;
/** Chroma at the rim; beyond this dots pin to the edge. */
const WHEEL_C = 0.3;

const tintOf = (group: string | null) =>
  LINK_GROUPS.find((g) => g.id === group)?.tint ?? "#888";

function polar(c: number, h: number) {
  const r = (Math.min(c, WHEEL_C) / WHEEL_C) * R;
  const a = (h * Math.PI) / 180;
  return { x: CX + r * Math.cos(a), y: CY - r * Math.sin(a) };
}

// Hue ring rendered as a conic gradient: CSS angles run clockwise from east
// ("from 90deg"), while our hue runs counter-clockwise, hence 360 - a.
const conic = `conic-gradient(from 90deg, ${Array.from({ length: 25 }, (_, i) => {
  const a = i * 15;
  return `oklch(0.7 0.14 ${wrapHue(360 - a)}) ${a}deg`;
}).join(", ")})`;

export const ColorWheel = observer(function ColorWheel() {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragId = useRef<string | null>(null);

  const pointToLch = (e: PointerEvent) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * SIZE - CX;
    const y = ((e.clientY - rect.top) / rect.height) * SIZE - CY;
    const dist = Math.hypot(x, y);
    return {
      c: Math.min(dist / R, 1) * WHEEL_C,
      h: wrapHue((Math.atan2(-y, x) * 180) / Math.PI),
    };
  };

  const startDrag = useWindowDrag({
    onStart: () => {
      if (dragId.current) store.beginEdit(dragId.current);
    },
    onMove: (e) => {
      if (dragId.current) store.updateAnchor(pointToLch(e));
    },
    onEnd: () => {
      dragId.current = null;
      store.endEdit();
    },
  });

  const anchorId = store.activeAnchorId ?? store.selectedId;
  const anchor = store.palette.find((c) => c.id === anchorId);
  const followers = store.linkedToAnchor;
  const limited = new Set(store.limited);
  const anchorPos = anchor ? polar(anchor.c, anchor.h) : null;

  // Draw the anchor last so it sits on top.
  const ordered = [...store.palette].sort(
    (a, b) => Number(a.id === anchorId) - Number(b.id === anchorId),
  );

  return (
    <div className="wheel" style={{ width: SIZE, height: SIZE }}>
      <div className="wheel-bg" style={{ background: conic, inset: PAD }} />
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={SIZE}
        height={SIZE}
        onPointerDown={(e) => {
          // Dragging empty wheel space moves the selected color.
          if (!store.selectedId) return;
          dragId.current = store.selectedId;
          startDrag(e);
        }}
      >
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <circle key={f} cx={CX} cy={CY} r={R * f} className="wheel-ring" />
        ))}
        {[0, 60, 120, 180, 240, 300].map((h) => {
          const p = polar(WHEEL_C, h);
          return <line key={h} x1={CX} y1={CY} x2={p.x} y2={p.y} className="wheel-ring" />;
        })}

        {anchorPos &&
          store.palette
            .filter((c) => followers.has(c.id))
            .map((c) => {
              const p = polar(c.c, c.h);
              return (
                <line
                  key={c.id}
                  x1={anchorPos.x}
                  y1={anchorPos.y}
                  x2={p.x}
                  y2={p.y}
                  stroke={tintOf(c.group)}
                  className="wheel-link"
                />
              );
            })}

        {ordered.map((c) => {
          const p = polar(c.c, c.h);
          const isAnchor = c.id === anchorId;
          const hex = store.hexById.get(c.id)!;
          return (
            <g
              key={c.id}
              className="wheel-dot"
              onPointerDown={(e) => {
                e.stopPropagation();
                dragId.current = c.id;
                startDrag(e);
              }}
            >
              <title>{`${c.name} ${hex}`}</title>
              {isAnchor && <circle cx={p.x} cy={p.y} r={13} className="wheel-anchor-ring" />}
              {followers.has(c.id) && (
                <circle cx={p.x} cy={p.y} r={10} fill="none" stroke={tintOf(c.group)} strokeDasharray="2 2" />
              )}
              <circle
                cx={p.x}
                cy={p.y}
                r={isAnchor ? 9 : 7}
                fill={hex}
                stroke="rgba(0,0,0,.5)"
                strokeWidth={1}
              />
              {limited.has(c.id) && <circle cx={p.x + 7} cy={p.y - 7} r={3} className="limit-dot" />}
            </g>
          );
        })}

        {anchor && anchorPos && (
          <text
            x={anchorPos.x + 14}
            y={anchorPos.y + 4}
            className="wheel-label"
            textAnchor={anchorPos.x > SIZE - 90 ? "end" : "start"}
            dx={anchorPos.x > SIZE - 90 ? -28 : 0}
          >
            {anchor.name} {store.hexById.get(anchor.id)}
          </text>
        )}
      </svg>
    </div>
  );
});
