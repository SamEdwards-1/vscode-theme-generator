import { useRef } from "react";
import { clamp } from "../color/color";
import { useWindowDrag } from "./useWindowDrag";

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  /** Keyboard step. */
  step: number;
  /** CSS background for the track. */
  track?: string;
  format: (v: number) => string;
  onStart: () => void;
  onChange: (v: number) => void;
  onEnd: () => void;
  /** Marks the handle as having hit a boundary. */
  warn?: boolean;
}

export function GradientSlider(p: Props) {
  const trackRef = useRef<HTMLDivElement>(null);

  const valueAt = (clientX: number) => {
    const r = trackRef.current!.getBoundingClientRect();
    return p.min + clamp((clientX - r.left) / r.width, 0, 1) * (p.max - p.min);
  };

  const onPointerDown = useWindowDrag({
    onStart: () => p.onStart(),
    onMove: (e) => p.onChange(valueAt(e.clientX)),
    onEnd: () => p.onEnd(),
  });

  const onKeyDown = (e: React.KeyboardEvent) => {
    const mult = e.shiftKey ? 10 : 1;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = p.value + p.step * mult;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = p.value - p.step * mult;
    if (e.key === "Home") next = p.min;
    if (e.key === "End") next = p.max;
    if (next === null) return;
    e.preventDefault();
    p.onStart();
    p.onChange(clamp(next, p.min, p.max));
    p.onEnd();
  };

  const pct = ((p.value - p.min) / (p.max - p.min)) * 100;

  return (
    <div className="slider">
      <div className="slider-head">
        <span>{p.label}</span>
        <span className="slider-value">{p.format(p.value)}</span>
      </div>
      <div
        ref={trackRef}
        className={"slider-track" + (p.track ? " has-gradient" : "")}
        style={p.track ? { background: p.track } : undefined}
        onPointerDown={onPointerDown}
      >
        {!p.track && <div className="slider-fill" style={{ width: `${pct}%` }} />}
        <div
          className={"slider-thumb" + (p.warn ? " warn" : "")}
          style={{ left: `${pct}%` }}
          role="slider"
          tabIndex={0}
          aria-label={p.label}
          aria-valuemin={p.min}
          aria-valuemax={p.max}
          aria-valuenow={p.value}
          aria-valuetext={p.format(p.value)}
          onKeyDown={onKeyDown}
        />
      </div>
    </div>
  );
}
