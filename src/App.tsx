import { observer } from "mobx-react-lite";
import { useEffect, useRef } from "react";
import { ColorsPanel } from "./components/assign/ColorsPanel";
import { SyntaxPanel } from "./components/assign/SyntaxPanel";
import { PalettePanel } from "./components/palette/PalettePanel";
import { FitToStage } from "./components/preview/FitToStage";
import { VSCodePreview } from "./components/preview/VSCodePreview";
import { TopBar } from "./components/TopBar";
import { store } from "./stores/ThemeStore";
import { ui, type SidebarTab } from "./stores/UiStore";
import { useWindowDrag } from "./ui/useWindowDrag";
import { PreviewPicker } from "./components/preview/PreviewPicker";

const TABS: { id: SidebarTab; label: string }[] = [
  { id: "palette", label: "Palette" },
  { id: "colors", label: "Colors" },
  { id: "syntax", label: "Syntax" },
];

export const App = observer(function App() {
  const resizeStart = useRef({ x: 0, width: 400 });
  const resize = useWindowDrag({
    onStart: (e) => { resizeStart.current = { x: e.clientX, width: ui.sidebarWidth }; },
    onMove: (e) => ui.setSidebarWidth(resizeStart.current.width + e.clientX - resizeStart.current.x),
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target;
      if (target instanceof Element && target.matches("input[type=text], input:not([type]), textarea")) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        store.undo();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        store.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="app">
      <TopBar />
      <div className="workspace">
        <aside className="sidebar" style={{ width: ui.sidebarWidth }}>
          <nav className="tabs" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={ui.tab === t.id}
                className={ui.tab === t.id ? "active" : ""}
                onClick={() => ui.setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>
          {ui.tab === "palette" && <PalettePanel />}
          {ui.tab === "colors" && <ColorsPanel />}
          {ui.tab === "syntax" && <SyntaxPanel />}
        </aside>
        <div className="sidebar-resizer" role="separator" aria-label="Editor width" aria-orientation="vertical"
          aria-valuemin={350} aria-valuemax={720} aria-valuenow={ui.sidebarWidth} tabIndex={0}
          onPointerDown={(e) => { e.currentTarget.focus(); resize(e); }} onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault(); ui.setSidebarWidth(ui.sidebarWidth + (e.key === "ArrowRight" ? 20 : -20));
            }
          }} />
        <main className="stage">
          <label className="toggle preview-pick-toggle"><input type="checkbox" checked={ui.pickColors}
            onChange={(e) => ui.setPickColors(e.target.checked)} /> Pick colors from preview</label>
          <PreviewPicker>
            <FitToStage width={1100} height={660}>
              <VSCodePreview />
            </FitToStage>
          </PreviewPicker>
          <p className="stage-hint">{ui.pickColors ? "Click text, a border or a fill to select its palette color." : "Click any part of the preview to jump to its colors."}</p>
        </main>
      </div>
    </div>
  );
});
