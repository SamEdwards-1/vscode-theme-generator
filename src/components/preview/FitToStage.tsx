import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

interface Props {
  width: number;
  height: number;
  children: ReactNode;
}

/** Renders children at a fixed design size, scaled down to fit the container. */
export function FitToStage({ width, height, children }: Props) {
  const outer = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = outer.current!;
    const ro = new ResizeObserver(([entry]) => {
      const { width: w, height: h } = entry.contentRect;
      setScale(Math.min(1, w / width, h / height));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, height]);

  return (
    <div ref={outer} className="fit-outer">
      <div style={{ width: width * scale, height: height * scale }}>
        <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
