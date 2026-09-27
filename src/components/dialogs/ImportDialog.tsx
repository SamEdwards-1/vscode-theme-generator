import { observer } from "mobx-react-lite";
import { useMemo, useRef, useState } from "react";
import { lchToHex } from "../../color/color";
import { importVSCodeTheme, type ImportResult } from "../../import/importTheme";
import { parseJsonc } from "../../import/jsonc";
import { store } from "../../stores/ThemeStore";
import type { ThemeDocument } from "../../stores/types";
import { ui } from "../../stores/UiStore";
import { GradientSlider } from "../../ui/GradientSlider";
import { UploadIcon } from "../../ui/icons";
import { Modal } from "../../ui/Modal";

type Parsed =
  | { kind: "empty" }
  | { kind: "error"; message: string }
  | { kind: "project"; doc: ThemeDocument }
  | { kind: "theme"; result: ImportResult };

const isProject = (v: unknown): v is ThemeDocument =>
  !!v && typeof v === "object" && (v as ThemeDocument).version === 1 && Array.isArray((v as ThemeDocument).palette);

export const ImportDialog = observer(function ImportDialog({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [tolerance, setTolerance] = useState(0.015);
  const [keepTokenRules, setKeepTokenRules] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const parsed: Parsed = useMemo(() => {
    if (!text.trim()) return { kind: "empty" };
    try {
      const json = parseJsonc(text);
      if (isProject(json)) return { kind: "project", doc: json };
      const fallback = fileName?.replace(/(-color-theme)?\.jsonc?$/i, "") || "Imported theme";
      return { kind: "theme", result: importVSCodeTheme(json, { tolerance, keepTokenRules }, fallback) };
    } catch (e) {
      return { kind: "error", message: e instanceof Error ? e.message : String(e) };
    }
  }, [text, tolerance, keepTokenRules, fileName]);

  const readFile = async (file: File) => {
    setFileName(file.name);
    setText(await file.text());
  };

  const doImport = () => {
    if (parsed.kind === "project") store.importDocument(parsed.doc);
    else if (parsed.kind === "theme") store.importDocument(parsed.result.doc);
    else return;
    ui.setTab("palette");
    onClose();
  };

  return (
    <Modal
      title="Import theme"
      wide
      onClose={onClose}
      footer={
        <>
          <span className="muted foot-note">Importing replaces the current theme (Undo restores it).</span>
          <button className="btn primary" disabled={parsed.kind !== "project" && parsed.kind !== "theme"} onClick={doImport}>
            Import
          </button>
        </>
      }
    >
      <div
        className={"drop-zone" + (dragOver ? " over" : "")}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files[0];
          if (f) readFile(f);
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".json,.jsonc,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) readFile(f);
            e.target.value = "";
          }}
        />
        <button className="btn" onClick={() => fileRef.current?.click()}>
          <UploadIcon /> Choose file…
        </button>
        <span className="muted">
          {fileName ?? "or drop a *-color-theme.json here, or paste its contents below"}
        </span>
      </div>
      <textarea
        className="import-text"
        placeholder={'{\n  "name": "My Theme",\n  "colors": { … },\n  "tokenColors": [ … ]\n}'}
        value={text}
        spellCheck={false}
        onChange={(e) => {
          setFileName(null);
          setText(e.target.value);
        }}
      />

      {parsed.kind === "error" && <p className="form-errors">{parsed.message}</p>}
      {parsed.kind === "project" && (
        <p className="import-note">
          Theme Generator project: <b>{parsed.doc.name}</b> with {parsed.doc.palette.length} palette colors.
        </p>
      )}
      {parsed.kind === "theme" && (
        <>
          <div className="import-options">
            <GradientSlider
              label="Merge similar colors"
              value={tolerance}
              min={0}
              max={0.04}
              step={0.001}
              format={(v) => (v === 0 ? "Off (exact)" : v < 0.012 ? "Subtle" : v < 0.025 ? "Balanced" : "Strong")}
              onStart={() => {}}
              onChange={(v) => setTolerance(Math.round(v * 1000) / 1000)}
              onEnd={() => {}}
            />
            <p className="hint">
              Near-identical colors share one palette entry; their lightness difference becomes a derived offset,
              so they move together when you edit.
            </p>
            <label className="toggle">
              <input type="checkbox" checked={keepTokenRules} onChange={(e) => setKeepTokenRules(e.target.checked)} />
              Keep all {parsed.result.stats.tokenRules} token rules (exact syntax colors)
            </label>
          </div>
          <ImportPreview result={parsed.result} />
        </>
      )}
    </Modal>
  );
});

function ImportPreview({ result }: { result: ImportResult }) {
  const { doc, stats } = result;
  return (
    <div className="import-preview">
      <div className="import-stats">
        <span>
          <b>{doc.name}</b> ({doc.type})
        </span>
        <span>{stats.workbenchKeys} UI colors</span>
        <span>
          {stats.uniqueColors} unique colors → <b>{stats.paletteSize}</b> palette entries
        </span>
        <span title="Largest OKLab difference between an original color and its imported version; below ~0.02 is hard to see.">
          max drift {stats.maxError === 0 ? "none" : stats.maxError.toFixed(3)}
        </span>
      </div>
      <div className="import-palette">
        {doc.palette.map((c) => (
          <span key={c.id} style={{ background: lchToHex(c) }} title={c.name} />
        ))}
      </div>
      {stats.warnings.length > 0 && (
        <ul className="import-warnings">
          {stats.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
