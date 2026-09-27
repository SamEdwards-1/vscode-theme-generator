import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState } from "react";
import { KNOWN_KEYS, WORKBENCH_GROUPS, defaultAssignment, type WorkbenchKey } from "../../data/workbench";
import { store } from "../../stores/ThemeStore";
import { ui } from "../../stores/UiStore";
import { ChevronIcon, ResetIcon } from "../../ui/icons";
import { AssignmentEditor, describe } from "./AssignmentEditor";
import { AssignmentSwatch } from "./AssignmentSwatch";

interface Group {
  id: string;
  label: string;
  keys: { key: string; description?: string; def?: WorkbenchKey }[];
}

export const ColorsPanel = observer(function ColorsPanel() {
  const [filter, setFilter] = useState("");
  const groupRefs = useRef(new Map<string, HTMLDivElement>());
  const q = filter.trim().toLowerCase();

  // Scroll to a group picked by clicking the preview.
  useEffect(() => {
    const id = ui.focusedGroup;
    if (!id) return;
    groupRefs.current.get(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    ui.clearFocus();
  }, [ui.focusedGroup]);

  // Keys from imported themes that aren't in the curated groups.
  const otherKeys = Object.keys(store.workbench)
    .filter((k) => !KNOWN_KEYS.has(k))
    .sort();
  const groups: Group[] = [
    ...WORKBENCH_GROUPS.map((g) => ({
      id: g.id,
      label: g.label,
      keys: g.keys.map((k) => ({ key: k.key, description: k.description, def: k })),
    })),
    ...(otherKeys.length ? [{ id: "other", label: "Other (imported)", keys: otherKeys.map((key) => ({ key })) }] : []),
  ];

  return (
    <div className="panel-scroll">
      <div className="filter-bar">
        <input
          className="filter-input"
          placeholder="Filter color keys…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      {groups.map((g) => {
        const keys = q ? g.keys.filter((k) => k.key.toLowerCase().includes(q)) : g.keys;
        if (keys.length === 0) return null;
        const isOpen = q !== "" || ui.openGroups.has(g.id);
        return (
          <div
            key={g.id}
            className="group"
            ref={(el) => {
              if (el) groupRefs.current.set(g.id, el);
              else groupRefs.current.delete(g.id);
            }}
          >
            <button className={"group-head" + (isOpen ? " open" : "")} onClick={() => ui.toggleGroup(g.id)}>
              <span className="count">{keys.length}</span>
              {g.label}
              <span className="group-swatches">
                {keys.slice(0, 6).map((k) => (
                  <span key={k.key} style={{ background: store.workbenchColors[k.key] ?? "transparent" }} />
                ))}
              </span>
              <ChevronIcon />
            </button>
            {isOpen &&
              keys.map(({ key, description, def }) => {
                const a = store.workbench[key];
                const isEditing = ui.editingKey === key;
                const fallback = def ? defaultAssignment(def, store.type) : { source: "fg", alpha: 1 };
                return (
                  <div key={key} className={"assign-row" + (isEditing ? " editing" : "")}>
                    <div className="assign-main" onClick={() => ui.setEditing(isEditing ? null : key)}>
                      <AssignmentSwatch assignment={a} />
                      <div className="assign-text">
                        <span className="assign-key" title={description}>{key}</span>
                        <span className="assign-source">{a ? describe(a) : "VS Code default"}</span>
                      </div>
                      {def && (
                        <button
                          className="icon-btn"
                          title="Reset to default"
                          onClick={(e) => {
                            e.stopPropagation();
                            store.resetWorkbenchKey(key);
                          }}
                        >
                          <ResetIcon />
                        </button>
                      )}
                    </div>
                    {isEditing && (
                      <>
                        <AssignmentEditor value={a ?? fallback} onChange={(next) => store.setWorkbench(key, next)} />
                        <div className="assign-actions">
                          <button className="btn-ghost" onClick={() => store.setWorkbench(key, null)}>
                            Unset (use VS Code default)
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
          </div>
        );
      })}
    </div>
  );
});
