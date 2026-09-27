import { observer } from "mobx-react-lite";
import { useState } from "react";
import { downloadJson, slugify } from "../export/exportTheme";
import { store } from "../stores/ThemeStore";
import { CopyIcon, DownloadIcon, PackageIcon, RedoIcon, UndoIcon, UploadIcon } from "../ui/icons";
import { ExportDialog } from "./dialogs/ExportDialog";
import { ImportDialog } from "./dialogs/ImportDialog";

export const TopBar = observer(function TopBar() {
  const [notice, setNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"import" | "export" | null>(null);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2500);
  };

  return (
    <header className="topbar">
      <div className="brand">
        Theme Generator <span>for VS Code</span>
      </div>
      <input
        className="theme-name"
        value={store.name}
        onFocus={store.beginBatch}
        onBlur={store.endBatch}
        onChange={(e) => store.setName(e.target.value)}
        aria-label="Theme name"
      />
      <div className="segmented small" title="The theme's base type (affects VS Code defaults for unset keys)">
        {(["dark", "light"] as const).map((t) => (
          <button key={t} className={store.type === t ? "active" : ""} onClick={() => store.setType(t)}>
            {t}
          </button>
        ))}
      </div>
      <select
        className="new-theme"
        value=""
        onChange={(e) => {
          const v = e.target.value as "dark" | "light";
          if (v) store.newTheme(v);
        }}
        title="Start over from a preset (undoable)"
      >
        <option value="">New from preset…</option>
        <option value="dark">Dark preset</option>
        <option value="light">Light preset</option>
      </select>

      <div className="spacer" />
      {notice && <span className="notice">{notice}</span>}

      <button className="icon-btn" onClick={store.undo} disabled={!store.pastCount} title="Undo (Ctrl+Z)">
        <UndoIcon />
      </button>
      <button className="icon-btn" onClick={store.redo} disabled={!store.futureCount} title="Redo (Ctrl+Shift+Z)">
        <RedoIcon />
      </button>

      <button className="btn" onClick={() => setDialog("import")} title="Import a VS Code theme or open a saved project">
        <UploadIcon /> <span className="btn-label">Import</span>
      </button>
      <button
        className="btn"
        onClick={() => downloadJson(`${slugify(store.name)}.project.json`, store.document)}
        title="Save the editable project (palette, links and assignments)"
      >
        <DownloadIcon /> <span className="btn-label">Save project</span>
      </button>
      <button
        className="btn"
        onClick={async () => {
          await navigator.clipboard.writeText(JSON.stringify(store.themeJson, null, 2));
          flash("Theme JSON copied");
        }}
        title="Copy the VS Code color theme JSON"
      >
        <CopyIcon /> <span className="btn-label">Copy</span>
      </button>
      <button className="btn primary" onClick={() => setDialog("export")} title="Download as .vsix extension or theme .json">
        <PackageIcon /> <span className="btn-label">Export</span>
      </button>

      {dialog === "import" && <ImportDialog onClose={() => setDialog(null)} />}
      {dialog === "export" && <ExportDialog onClose={() => setDialog(null)} />}
    </header>
  );
});
