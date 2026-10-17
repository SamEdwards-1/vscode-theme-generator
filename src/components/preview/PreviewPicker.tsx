import { observer } from "mobx-react-lite";
import { useEffect, useState, type ReactNode } from "react";
import { store } from "../../stores/ThemeStore";
import { ui } from "../../stores/UiStore";
import { inspectPreview, type PickedColor } from "./inspect";

export const PreviewPicker = observer(function PreviewPicker({ children }: { children: ReactNode }) {
  const [picked, setPicked] = useState<PickedColor[]>([]);
  const [active, setActive] = useState("");
  useEffect(() => { if (!ui.pickColors) setPicked([]); }, [ui.pickColors]);
  const choose = (pick: PickedColor) => {
    setActive(pick.key);
    const source = pick.key.startsWith("syntax:") ? store.view.tokenAssignment(pick.key.slice(7)) : store.workbench[pick.key];
    if (source && store.palette.some((c) => c.id === source.source)) {
      store.select(source.source);
      ui.setTab("palette");
      requestAnimationFrame(() => document.getElementById(`palette-${source.source}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
    }
  };
  return <>
    <div className={"preview-pick-area" + (ui.pickColors ? " picking" : "")}
      onClickCapture={(e) => {
        if (!ui.pickColors || !(e.target instanceof Element)) return;
        const root = e.currentTarget.querySelector<HTMLElement>(".pv");
        if (!root?.contains(e.target)) return;
        e.stopPropagation();
        const picks = inspectPreview(e.target, root, e.clientX, e.clientY);
        setPicked(picks);
        if (picks[0]) choose(picks[0]);
      }}>{children}</div>
    {ui.pickColors && picked.length > 0 && <div className="preview-picked" aria-label="Picked colors">
      {picked.map((pick) => {
        const syntax = pick.key.startsWith("syntax:");
        const assignment = syntax ? store.view.tokenAssignment(pick.key.slice(7)) : store.workbench[pick.key];
        const color = syntax ? store.view.token(pick.key.slice(7)).color : store.view.color(pick.key);
        const linked = assignment && store.palette.some((c) => c.id === assignment.source);
        return <button key={pick.part} className={active === pick.key ? "active" : ""} onClick={() => choose(pick)}
          title={linked ? "Select this palette color" : "This color is a literal or VS Code default; assign it in Colors or Syntax"}>
          <span className="picked-swatch" style={{ background: color ?? "transparent" }} />
          <span>{pick.part}<small>{pick.key}{!linked && " · default / custom"}</small></span>
        </button>;
      })}
    </div>}
  </>;
});
