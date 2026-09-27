import { useCallback, useEffect, useRef } from "react";

export interface DragHandlers {
  onStart?: (e: PointerEvent) => void;
  onMove: (e: PointerEvent) => void;
  onEnd?: (e: PointerEvent) => void;
}

/**
 * Starts a drag on pointerdown and tracks it on `window`, so the gesture keeps
 * working when the pointer leaves the element (the "canvas event trap").
 * Returns a pointerdown handler to attach to the draggable element.
 */
export function useWindowDrag(handlers: DragHandlers) {
  const ref = useRef(handlers);
  ref.current = handlers;
  const cleanup = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanup.current?.(), []);

  return useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const native = e.nativeEvent;
    ref.current.onStart?.(native);
    ref.current.onMove(native);

    const move = (ev: PointerEvent) => ref.current.onMove(ev);
    const up = (ev: PointerEvent) => {
      cleanup.current?.();
      ref.current.onEnd?.(ev);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    document.body.classList.add("dragging");
    cleanup.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      document.body.classList.remove("dragging");
      cleanup.current = null;
    };
  }, []);
}
