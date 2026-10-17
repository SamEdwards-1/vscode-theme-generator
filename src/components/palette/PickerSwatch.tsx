import { observer } from "mobx-react-lite";
import { useRef, useState, type ReactNode } from "react";
import { store } from "../../stores/ThemeStore";
import type { PaletteColor } from "../../stores/types";
import { ColorPicker } from "./ColorPicker";

export const PickerSwatch = observer(function PickerSwatch({ id, className, children }: {
  id: string; className: string; children?: ReactNode;
}) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const before = useRef<PaletteColor[]>([]);
  const c = store.palette.find((c) => c.id === id);
  if (!c) return null;
  return <>
    <button type="button" className={className} style={{ background: store.hexById.get(id) }}
      aria-label={`Edit ${c.name} color`} aria-expanded={!!anchor} title={`Edit ${c.name} color`}
      onClick={(e) => {
        e.stopPropagation();
        if (anchor) { setAnchor(null); return; }
        store.select(id);
        before.current = store.document.palette;
        setAnchor(e.currentTarget);
      }}>{children}</button>
    {anchor && <ColorPicker name={c.name} anchor={anchor} color={{ l: c.l, c: c.c, h: c.h }}
      original={before.current.find((c) => c.id === id)!}
      onStart={(guard = true) => store.beginEdit(id, guard)} onChange={store.updateAnchor} onEnd={store.endEdit}
      onRestore={() => store.restorePalette(before.current)} onClose={() => setAnchor(null)} />}
  </>;
});
