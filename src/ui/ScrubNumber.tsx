import { useRef, useState } from "react";
import { clamp } from "../color/color";
import { useWindowDrag } from "./useWindowDrag";

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  parse?: (text: string) => number | null;
  onStart: () => void;
  onChange: (value: number) => void;
  onEnd: () => void;
}

/** Click to type, drag vertically to scrub; a drag makes one history entry. */
export function ScrubNumber(p: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const start = useRef({ y: 0, value: 0, moved: false });
  const once = (value: number | null) => {
    if (value === null || !Number.isFinite(value)) return;
    p.onStart();
    p.onChange(clamp(value, p.min, p.max));
    p.onEnd();
  };
  const edit = () => { setText(p.format(p.value)); setEditing(true); };
  const drag = useWindowDrag({
    onStart: (e) => { start.current = { y: e.clientY, value: p.value, moved: false }; },
    onMove: (e) => {
      const s = start.current;
      const distance = s.y - e.clientY;
      if (!s.moved && Math.abs(distance) < 3) return;
      if (!s.moved) { s.moved = true; p.onStart(); }
      p.onChange(clamp(s.value + Math.round(distance / (e.shiftKey ? 12 : 3)) * p.step, p.min, p.max));
    },
    onEnd: () => { if (start.current.moved) p.onEnd(); else edit(); },
  });
  if (editing) return <input
    className="scrub-input" aria-label={p.label} value={text} autoFocus
    onFocus={(e) => e.target.select()} onChange={(e) => setText(e.target.value)}
    onBlur={() => { once(p.parse ? p.parse(text) : Number.parseFloat(text)); setEditing(false); }}
    onKeyDown={(e) => {
      e.stopPropagation();
      if (e.key === "Enter") e.currentTarget.blur();
      if (e.key === "Escape") { setEditing(false); }
    }}
  />;
  return <button type="button" className="scrub-number" aria-label={`${p.label}: ${p.format(p.value)}`}
    title="Drag up or down; click to type" onPointerDown={drag}
    onClick={(e) => { if (e.detail === 0) edit(); }}
    onKeyDown={(e) => {
      const sign = ["ArrowUp", "ArrowRight"].includes(e.key) ? 1 : ["ArrowDown", "ArrowLeft"].includes(e.key) ? -1 : 0;
      if (sign) { e.preventDefault(); once(p.value + sign * p.step * (e.shiftKey ? 10 : 1)); }
    }}>{p.format(p.value)}</button>;
}
