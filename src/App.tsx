import { observer } from "mobx-react-lite";
import { useEffect } from "react";
import { ColorsPanel } from "./components/assign/ColorsPanel";
import { SyntaxPanel } from "./components/assign/SyntaxPanel";
import { PalettePanel } from "./components/palette/PalettePanel";
import { FitToStage } from "./components/preview/FitToStage";
import { VSCodePreview } from "./components/preview/VSCodePreview";
import { TopBar } from "./components/TopBar";
import { store } from "./stores/ThemeStore";
import { ui, type SidebarTab } from "./stores/UiStore";

const TABS: { id: SidebarTab; label: string }[] = [
  { id: "palette", label: "Palette" },
  { id: "colors", label: "Colors" },
  { id: "syntax", label: "Syntax" },
];

export const App = observer(function App() {
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
        <aside className="sidebar">
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
        <main className="stage">
          <FitToStage width={1100} height={660}>
            <VSCodePreview />
          </FitToStage>
          <p className="stage-hint">Click any part of the preview to jump to its colors.</p>
        </main>
      </div>
    </div>
  );
});
