import { observer } from "mobx-react-lite";
import { C_MAX, lchToHex } from "../../color/color";
import { LINK_GROUPS } from "../../data/presets";
import type { BoundaryMode } from "../../engine/relational";
import { store } from "../../stores/ThemeStore";
import { GradientSlider } from "../../ui/GradientSlider";
import { HexInput } from "../../ui/HexInput";
import {
  LinkIcon,
  PlusIcon,
  ResetIcon,
  ShieldIcon,
  TrashIcon,
  UnlinkIcon,
  WarnIcon,
} from "../../ui/icons";
import { ColorWheel } from "./ColorWheel";
import { ContrastChecks } from "./ContrastChecks";
import { LightnessRail } from "./LightnessRail";

const MODES: { id: BoundaryMode; label: string; hint: string }[] = [
  { id: "clamp", label: "Clamp", hint: "Followers stop at 0 / max; offsets break at the edge." },
  { id: "proportional", label: "Compress", hint: "Followers near an edge move less, so none flatten." },
  { id: "preserve", label: "Rigid", hint: "The set moves as one and stops when any follower hits an edge." },
];

const gradient = (stops: string[]) => `linear-gradient(to right, ${stops.join(", ")})`;
const steps = (n: number) => Array.from({ length: n + 1 }, (_, i) => i / n);

export const PalettePanel = observer(function PalettePanel() {
  return (
    <div className="panel-scroll">
      <section className="section">
        <div className="wheel-row">
          <ColorWheel />
          <LightnessRail />
        </div>
        <LinkSettings />
      </section>
      <SelectedEditor />
      <PaletteList />
      <GlobalControls />
      <ContrastChecks />
    </div>
  );
});

const LinkSettings = observer(function LinkSettings() {
  const mode = MODES.find((m) => m.id === store.boundaryMode)!;
  return (
    <div className="link-settings">
      <div className="row-between">
        <span className="label">Boundary behavior</span>
        <label className="toggle" title="When on, dragging any linked color moves every linked color, not just its group.">
          <input
            type="checkbox"
            checked={store.crossGroup}
            onChange={(e) => store.setCrossGroup(e.target.checked)}
          />
          Link across groups
        </label>
      </div>
      <div className="segmented">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={m.id === store.boundaryMode ? "active" : ""}
            onClick={() => store.setBoundaryMode(m.id)}
            title={m.hint}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="hint">{mode.hint}</p>
      <div className="row-between guard-row">
        <label className="toggle" title="While dragging, stop before any text color that meets the threshold would drop below it.">
          <input
            type="checkbox"
            checked={store.guardEnabled}
            onChange={(e) => store.setGuard(e.target.checked)}
          />
          <ShieldIcon /> Contrast guard
        </label>
        <select
          value={store.guardThreshold}
          disabled={!store.guardEnabled}
          onChange={(e) => store.setGuard(true, Number(e.target.value))}
        >
          <option value={3}>3:1 (large text)</option>
          <option value={4.5}>4.5:1 (AA)</option>
          <option value={7}>7:1 (AAA)</option>
        </select>
      </div>
      {store.guardHolding.length > 0 && (
        <p className="guard-holding">
          Held by contrast guard: {store.guardHolding.slice(0, 3).join(", ")}
          {store.guardHolding.length > 3 ? ` +${store.guardHolding.length - 3}` : ""}
        </p>
      )}
    </div>
  );
});

const SelectedEditor = observer(function SelectedEditor() {
  const c = store.selected;
  if (!c) return null;
  const hex = store.hexById.get(c.id)!;
  const id = c.id;
  const followers = store.linkedToAnchor.size;
  const warn = store.limited.length > 0 || store.guardHolding.length > 0;

  const handlers = (key: "l" | "c" | "h") => ({
    onStart: () => store.beginEdit(id),
    onChange: (v: number) => store.updateAnchor({ [key]: v }),
    onEnd: () => store.endEdit(),
  });

  return (
    <section className="section">
      <div className="section-title">
        Anchor: {c.name}
        <span className="muted">
          {c.group === null ? "unlinked" : `${followers} follower${followers === 1 ? "" : "s"}`}
        </span>
      </div>
      <div className="anchor-head">
        <div className="anchor-swatch" style={{ background: hex }} />
        <HexInput value={hex} onCommit={(v) => store.setHex(id, v)} />
        {store.outOfGamut.has(id) && (
          <span className="gamut-warn" title="Outside sRGB; chroma is reduced for display and export.">
            <WarnIcon /> gamut
          </span>
        )}
      </div>
      <GradientSlider
        label="Lightness"
        value={c.l}
        min={0}
        max={1}
        step={0.01}
        track={gradient(steps(8).map((t) => lchToHex({ ...c, l: t })))}
        format={(v) => `${(v * 100).toFixed(0)}%`}
        warn={warn}
        {...handlers("l")}
      />
      <GradientSlider
        label="Chroma"
        value={c.c}
        min={0}
        max={C_MAX}
        step={0.005}
        track={gradient(steps(8).map((t) => lchToHex({ ...c, c: t * C_MAX })))}
        format={(v) => v.toFixed(3)}
        warn={warn}
        {...handlers("c")}
      />
      <GradientSlider
        label="Hue"
        value={c.h}
        min={0}
        max={360}
        step={1}
        track={gradient(steps(12).map((t) => lchToHex({ ...c, h: t * 360 })))}
        format={(v) => `${v.toFixed(0)}°`}
        warn={store.guardHolding.length > 0}
        {...handlers("h")}
      />
    </section>
  );
});

const PaletteList = observer(function PaletteList() {
  const anchorId = store.activeAnchorId ?? store.selectedId;
  const followers = store.linkedToAnchor;
  const limited = new Set(store.limited);

  return (
    <section className="section">
      <div className="section-title">
        Palette
        <button className="btn-ghost" onClick={store.addColor} title="Add a color">
          <PlusIcon /> Add
        </button>
      </div>
      <div className="swatch-list">
        {store.palette.map((c) => {
          const hex = store.hexById.get(c.id)!;
          const group = LINK_GROUPS.find((g) => g.id === c.group);
          const uses = store.usageCount.get(c.id) ?? 0;
          return (
            <div
              key={c.id}
              className={
                "swatch-row" +
                (c.id === anchorId ? " anchor" : "") +
                (followers.has(c.id) ? " follower" : "")
              }
              onClick={() => store.select(c.id)}
              style={followers.has(c.id) && group ? ({ "--link": group.tint } as React.CSSProperties) : undefined}
            >
              <div className="swatch" style={{ background: hex }}>
                {limited.has(c.id) && <span className="limit-dot" title="Hit a boundary" />}
              </div>
              <div className="swatch-text">
                <input
                  className="name-input"
                  value={c.name}
                  onFocus={store.beginBatch}
                  onBlur={store.endBatch}
                  onChange={(e) => store.renameColor(c.id, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="mono muted">
                  {hex}
                  {store.outOfGamut.has(c.id) && <span className="gamut-warn" title="Outside sRGB"> ⚠</span>}
                </span>
              </div>
              <span className="uses" title={`Used by ${uses} theme color${uses === 1 ? "" : "s"}`}>
                {uses || ""}
              </span>
              <button
                className="chain"
                style={{ color: group?.tint }}
                title={group ? `Linked: ${group.label} (click to change)` : "Unlinked (click to link)"}
                onClick={(e) => {
                  e.stopPropagation();
                  store.cycleColorGroup(c.id);
                }}
              >
                {group ? <LinkIcon /> : <UnlinkIcon />}
              </button>
              <button
                className="icon-btn danger"
                title="Remove (references keep their current hex)"
                onClick={(e) => {
                  e.stopPropagation();
                  store.removeColor(c.id);
                }}
              >
                <TrashIcon />
              </button>
            </div>
          );
        })}
      </div>
      <div className="legend">
        {LINK_GROUPS.map((g) => (
          <span key={g.id}>
            <span className="legend-dot" style={{ background: g.tint }} /> {g.label}
          </span>
        ))}
      </div>
    </section>
  );
});

const GlobalControls = observer(function GlobalControls() {
  const g = store.global;
  const handlers = (key: keyof typeof g) => ({
    onStart: store.beginGlobal,
    onChange: (v: number) => store.setGlobal({ [key]: v }),
    onEnd: store.endGlobal,
  });
  const warn = store.globalActive && (store.limited.length > 0 || store.guardHolding.length > 0);

  return (
    <section className="section">
      <div className="section-title">
        Master controls
        <button className="btn-ghost" onClick={store.resetGlobalReadout} title="Zero the slider readouts (colors stay as they are)">
          <ResetIcon /> Zero
        </button>
      </div>
      <div className="row-between">
        <span className="label">Applies to</span>
        <select value={store.globalScope} onChange={(e) => store.setGlobalScope(e.target.value)}>
          <option value="all">Whole palette</option>
          {LINK_GROUPS.map((lg) => (
            <option key={lg.id} value={lg.id}>
              {lg.label}
            </option>
          ))}
        </select>
      </div>
      <GradientSlider
        label="Hue shift"
        value={g.hueShift}
        min={-180}
        max={180}
        step={1}
        format={(v) => `${v > 0 ? "+" : ""}${v.toFixed(0)}°`}
        warn={warn}
        {...handlers("hueShift")}
      />
      <GradientSlider
        label="Chroma scale"
        value={g.chromaScale}
        min={0}
        max={2}
        step={0.01}
        format={(v) => `${(v * 100).toFixed(0)}%`}
        warn={warn}
        {...handlers("chromaScale")}
      />
      <GradientSlider
        label="Lightness offset"
        value={g.lightOffset}
        min={-0.5}
        max={0.5}
        step={0.01}
        format={(v) => `${v > 0 ? "+" : ""}${(v * 100).toFixed(0)}%`}
        warn={warn}
        {...handlers("lightOffset")}
      />
    </section>
  );
});
