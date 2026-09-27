import { observer } from "mobx-react-lite";
import { useState } from "react";
import { SYNTAX_GROUPS } from "../../data/syntax";
import { store } from "../../stores/ThemeStore";
import type { FontStyle } from "../../stores/types";
import { ChevronIcon } from "../../ui/icons";
import { AssignmentEditor, describe } from "./AssignmentEditor";
import { AssignmentSwatch } from "./AssignmentSwatch";

const STYLES: { id: FontStyle; label: string }[] = [
  { id: "italic", label: "I" },
  { id: "bold", label: "B" },
  { id: "underline", label: "U" },
];

export const SyntaxPanel = observer(function SyntaxPanel() {
  const [editing, setEditing] = useState<string | null>(null);
  const [showExtras, setShowExtras] = useState(false);
  const extras = store.extraTokens;
  const toggle = (id: string) => setEditing(editing === id ? null : id);

  return (
    <div className="panel-scroll">
      <p className="hint pad">
        Token colors map TextMate scopes to palette colors. Hover a row to see its scopes.
        {extras.length > 0 && " Imported rules below take precedence where they are more specific."}
      </p>
      {SYNTAX_GROUPS.map((g) => {
        const a = store.syntax[g.id];
        const isEditing = editing === g.id;
        const rendered = store.syntaxColors[g.id].color;
        const overridden = rendered !== store.resolve(a);
        return (
          <div key={g.id} className={"assign-row" + (isEditing ? " editing" : "")}>
            <div className="assign-main" onClick={() => toggle(g.id)}>
              <AssignmentSwatch assignment={a} />
              <div className="assign-text" title={g.scopes.join("\n")}>
                <span className="assign-key" style={{ color: rendered }}>
                  {g.label}
                </span>
                <span className="assign-source">
                  {describe(a)}
                  {overridden && <span className="warn-text" title="An imported rule wins for this group's main scope"> · overridden</span>}
                </span>
              </div>
              <div className="font-styles" onClick={(e) => e.stopPropagation()}>
                {STYLES.map((s) => (
                  <button
                    key={s.id}
                    className={"style-btn style-" + s.id + (a.fontStyle.includes(s.id) ? " active" : "")}
                    onClick={() => store.toggleFontStyle(g.id, s.id)}
                    title={s.id}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            {isEditing && (
              <AssignmentEditor
                value={a}
                onChange={(next) => store.setSyntax(g.id, { source: next.source, alpha: next.alpha, dl: next.dl })}
              />
            )}
          </div>
        );
      })}

      {extras.length > 0 && (
        <div className="group">
          <button className={"group-head" + (showExtras ? " open" : "")} onClick={() => setShowExtras(!showExtras)}>
            <span className="count">{extras.length}</span>
            Imported token rules
            <ChevronIcon />
          </button>
          {showExtras && (
            <>
              <div className="assign-actions">
                <button
                  className="btn-ghost"
                  onClick={store.clearExtraTokens}
                  title="Remove imported rules so the groups above fully control token colors"
                >
                  Remove imported rules
                </button>
              </div>
              {extras.map((r, i) => {
                const id = `extra:${i}`;
                const isEditing = editing === id;
                return (
                  <div key={id} className={"assign-row" + (isEditing ? " editing" : "")}>
                    <div className="assign-main" onClick={() => r.color && toggle(id)}>
                      <AssignmentSwatch assignment={r.color} />
                      <div className="assign-text" title={r.scope.join("\n")}>
                        <span className="assign-key">{r.name || r.scope[0]}</span>
                        <span className="assign-source">
                          {r.color ? describe(r.color) : "no color"}
                          {r.fontStyle ? ` · ${r.fontStyle}` : ""} · {r.scope.length} scope{r.scope.length === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>
                    {isEditing && r.color && (
                      <AssignmentEditor value={r.color} onChange={(next) => store.setExtraTokenColor(i, next)} />
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
});
