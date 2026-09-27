import { observer } from "mobx-react-lite";
import type { CSSProperties, ReactNode } from "react";
import { store } from "../../stores/ThemeStore";
import { ui } from "../../stores/UiStore";
import {
  AccountIcon,
  BranchIcon,
  DebugIcon,
  ExtensionsIcon,
  FilesIcon,
  GearIcon,
  SearchIcon,
} from "../../ui/icons";
import { tokenizeLine, type TokenKind } from "./tokenize";

const SAMPLE = `// Fetch a user profile, retrying and caching the result
import { cache } from "./cache.js";

const MAX_RETRIES = 3;
const BASE_URL = "https://api.example.com/v1";

export class ProfileService {
  constructor(client, ttl = 60_000) {
    this.client = client;
    this.ttl = ttl;
  }

  async getProfile(id, force = false) {
    const key = \`profile:\${id}\`;
    if (!force && cache.has(key)) {
      return cache.get(key);
    }

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const res = await this.client.fetch(\`\${BASE_URL}/users/\${id}\`);
        const profile = await res.json();
        cache.set(key, profile, this.ttl);
        return profile;
      } catch (err) {
        console.warn("Retrying", attempt, err.message);
      }
    }
    return null;
  }
}`;

const LINES = SAMPLE.split("\n").map(tokenizeLine);
const ACTIVE_LINE = 14;
const SELECTED_LINE = 21;

type Tree = { name: string; depth: number; folder?: boolean; open?: boolean; git?: "M" | "U" | "D" | "I"; active?: boolean };
const TREE: Tree[] = [
  { name: "node_modules", depth: 0, folder: true, git: "I" },
  { name: "src", depth: 0, folder: true, open: true },
  { name: "services", depth: 1, folder: true, open: true },
  { name: "profile.js", depth: 2, git: "M", active: true },
  { name: "cache.js", depth: 2 },
  { name: "session.js", depth: 2, git: "U" },
  { name: "index.js", depth: 1 },
  { name: "legacy.js", depth: 1, git: "D" },
  { name: ".gitignore", depth: 0 },
  { name: "package.json", depth: 0 },
  { name: "README.md", depth: 0, git: "M" },
];

/** Clickable region that jumps to its color group in the sidebar. */
function Region(p: { group: string; style?: CSSProperties; className?: string; children?: ReactNode }) {
  return (
    <div
      className={"pv-region " + (p.className ?? "")}
      style={p.style}
      onClick={(e) => {
        e.stopPropagation();
        ui.focusGroup(p.group);
      }}
    >
      {p.children}
    </div>
  );
}

export const VSCodePreview = observer(function VSCodePreview() {
  const view = store.view;
  // Unset keys fall back to VS Code's built-in defaults, as they would in VS Code.
  const c = (key: string, fallback = "transparent") => view.color(key) ?? fallback;
  const syn = store.syntaxColors;

  const tokenStyle = (kind: TokenKind): CSSProperties => {
    if (kind === "plain") return {};
    const s = syn[kind];
    return {
      color: s.color,
      fontStyle: s.fontStyle.includes("italic") ? "italic" : undefined,
      fontWeight: s.fontStyle.includes("bold") ? 700 : undefined,
      textDecoration: s.fontStyle.includes("underline") ? "underline" : undefined,
    };
  };

  const gitColor = (g?: Tree["git"]) =>
    g === "M"
      ? c("gitDecoration.modifiedResourceForeground")
      : g === "U"
        ? c("gitDecoration.untrackedResourceForeground")
        : g === "D"
          ? c("gitDecoration.deletedResourceForeground")
          : g === "I"
            ? c("gitDecoration.ignoredResourceForeground")
            : undefined;

  const border = (key: string) => {
    const v = view.color(key);
    return v ? `1px solid ${v}` : "none";
  };

  return (
    <div
      className="pv"
      style={{ background: c("editor.background"), color: c("foreground", "#ccc"), boxShadow: `0 12px 40px ${c("widget.shadow", "#0008")}` }}
    >
      {/* Title bar */}
      <Region
        group="titleBar"
        className="pv-title"
        style={{ background: c("titleBar.activeBackground"), color: c("titleBar.activeForeground"), borderBottom: border("titleBar.border") }}
      >
        <span className="pv-logo" style={{ color: c("focusBorder") }}>◆</span>
        <span className="pv-menu">File&nbsp;&nbsp;Edit&nbsp;&nbsp;Selection&nbsp;&nbsp;View&nbsp;&nbsp;Go&nbsp;&nbsp;Run</span>
        <span className="pv-title-text">profile.js — my-project — Visual Studio Code</span>
        <span className="pv-window-btns">─&nbsp;&nbsp;☐&nbsp;&nbsp;✕</span>
      </Region>

      <div className="pv-body">
        {/* Activity bar */}
        <Region
          group="activityBar"
          className="pv-activity"
          style={{ background: c("activityBar.background"), borderRight: border("activityBar.border") }}
        >
          {[FilesIcon, SearchIcon, BranchIcon, DebugIcon, ExtensionsIcon].map((Icon, i) => (
            <div
              key={i}
              className="pv-activity-item"
              style={{
                color: i === 0 ? c("activityBar.foreground") : c("activityBar.inactiveForeground"),
                borderLeft: `2px solid ${i === 0 ? c("activityBar.activeBorder") : "transparent"}`,
              }}
            >
              <Icon size={22} />
              {i === 2 && (
                <span className="pv-badge" style={{ background: c("activityBarBadge.background"), color: c("activityBarBadge.foreground") }}>
                  4
                </span>
              )}
            </div>
          ))}
          <div className="pv-spacer" />
          {[AccountIcon, GearIcon].map((Icon, i) => (
            <div key={i} className="pv-activity-item" style={{ color: c("activityBar.inactiveForeground") }}>
              <Icon size={22} />
            </div>
          ))}
        </Region>

        {/* Side bar */}
        <Region
          group="sideBar"
          className="pv-sidebar"
          style={{ background: c("sideBar.background"), color: c("sideBar.foreground"), borderRight: border("sideBar.border") }}
        >
          <div className="pv-sidebar-title" style={{ color: c("sideBarTitle.foreground") }}>EXPLORER</div>
          <div
            className="pv-section-head"
            style={{ background: c("sideBarSectionHeader.background"), color: c("sideBarSectionHeader.foreground"), borderTop: border("sideBarSectionHeader.border") }}
          >
            ⌄ MY-PROJECT
          </div>
          {TREE.map((t) => (
            <div
              key={t.name}
              className="pv-tree-item"
              style={{
                paddingLeft: 12 + t.depth * 12,
                background: t.active ? c("list.activeSelectionBackground") : undefined,
                color: gitColor(t.git) ?? (t.active ? c("list.activeSelectionForeground") : undefined),
                outline: t.active ? `1px solid ${c("list.focusOutline")}` : undefined,
                outlineOffset: -1,
                textDecoration: t.git === "D" ? "line-through" : undefined,
              }}
            >
              <span className="pv-twisty">{t.folder ? (t.open ? "⌄" : "›") : ""}</span>
              <span style={{ opacity: t.folder ? 1 : 0.9 }}>{t.name}</span>
              {t.git && t.git !== "I" && <span className="pv-git">{t.git}</span>}
            </div>
          ))}
          <div className="pv-spacer" />
          <div
            className="pv-section-head"
            style={{ background: c("sideBarSectionHeader.background"), color: c("sideBarSectionHeader.foreground"), borderTop: border("sideBarSectionHeader.border") }}
          >
            › OUTLINE
          </div>
        </Region>

        {/* Editor column */}
        <div className="pv-main">
          <Region
            group="tabs"
            className="pv-tabs"
            style={{ background: c("editorGroupHeader.tabsBackground"), borderBottom: border("editorGroupHeader.tabsBorder") }}
          >
            {["profile.js", "cache.js", "package.json"].map((name, i) => (
              <div
                key={name}
                className="pv-tab"
                style={{
                  background: i === 0 ? c("tab.activeBackground") : c("tab.inactiveBackground"),
                  color: i === 0 ? c("tab.activeForeground") : c("tab.inactiveForeground"),
                  borderRight: border("tab.border"),
                  borderTop: `1px solid ${i === 0 ? c("tab.activeBorderTop") : "transparent"}`,
                }}
              >
                <span style={{ color: syn.type.color }}>{i === 2 ? "{}" : "JS"}</span>
                {name}
                <span className="pv-tab-close">{i === 0 ? "●" : ""}</span>
              </div>
            ))}
          </Region>

          <Region
            group="breadcrumbs"
            className="pv-breadcrumbs"
            style={{ background: c("breadcrumb.background"), color: c("breadcrumb.foreground") }}
          >
            src › services › <span style={{ color: c("breadcrumb.focusForeground") }}>profile.js</span> ›{" "}
            <span style={{ color: syn.type.color }}>ProfileService</span>
          </Region>

          <Region group="editor" className="pv-editor" style={{ background: c("editor.background"), color: c("editor.foreground") }}>
            <div className="pv-code">
              {LINES.map((tokens, i) => {
                const n = i + 1;
                const indent = tokens[0]?.kind === "plain" ? Math.floor(tokens[0].text.length / 2) : 0;
                return (
                  <div
                    key={i}
                    className="pv-line"
                    style={{ background: n === ACTIVE_LINE ? c("editor.lineHighlightBackground") : undefined }}
                  >
                    <span
                      className="pv-gutter-mark"
                      style={{
                        background:
                          n >= 13 && n <= 16
                            ? c("editorGutter.modifiedBackground")
                            : n === 4
                              ? c("editorGutter.addedBackground")
                              : undefined,
                      }}
                    />
                    <span
                      className="pv-ln"
                      style={{ color: n === ACTIVE_LINE ? c("editorLineNumber.activeForeground") : c("editorLineNumber.foreground") }}
                    >
                      {n}
                    </span>
                    <span className="pv-text">
                      {Array.from({ length: indent }, (_, g) => (
                        <span
                          key={g}
                          className="pv-guide"
                          style={{ left: g * 2 + "ch", background: c("editorIndentGuide.background1") }}
                        />
                      ))}
                      {tokens.map((t, j) => {
                        const selected = n === SELECTED_LINE && t.text === "profile";
                        const found = t.text === "cache";
                        return (
                          <span
                            key={j}
                            style={{
                              ...tokenStyle(t.kind),
                              background: selected
                                ? c("editor.selectionBackground")
                                : found
                                  ? c("editor.findMatchHighlightBackground")
                                  : undefined,
                            }}
                          >
                            {t.text}
                          </span>
                        );
                      })}
                      {n === ACTIVE_LINE && <span className="pv-cursor" style={{ background: c("editorCursor.foreground") }} />}
                      {n === 25 && (
                        <span className="pv-squiggle" style={{ textDecorationColor: c("editorWarning.foreground") }}>
                          {" "}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>

            <Region
              group="widgets"
              className="pv-suggest"
              style={{ background: c("editorSuggestWidget.background"), border: border("editorSuggestWidget.border"), color: c("editor.foreground") }}
            >
              {["cache", "catch", "console"].map((s, i) => (
                <div key={s} style={{ background: i === 0 ? c("editorSuggestWidget.selectedBackground") : undefined }}>
                  <span style={{ color: syn.variable.color }}>◇</span> {s}
                </div>
              ))}
            </Region>

            <Region
              group="scrollbar"
              className="pv-scroll-thumb"
              style={{ background: c("scrollbarSlider.background") }}
            />
          </Region>

          {/* Panel / terminal */}
          <Region
            group="terminal"
            className="pv-panel"
            style={{ background: c("panel.background"), borderTop: border("panel.border") }}
          >
            <div className="pv-panel-tabs">
              {["PROBLEMS", "OUTPUT", "TERMINAL"].map((t) => (
                <span
                  key={t}
                  style={{
                    color: t === "TERMINAL" ? c("panelTitle.activeForeground") : c("panelTitle.inactiveForeground"),
                    borderBottom: `1px solid ${t === "TERMINAL" ? c("panelTitle.activeBorder") : "transparent"}`,
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
            <div className="pv-terminal" style={{ background: c("terminal.background"), color: c("terminal.foreground") }}>
              <div>
                <span style={{ color: c("terminal.ansiGreen") }}>➜</span>{" "}
                <span style={{ color: c("terminal.ansiCyan") }}>my-project</span>{" "}
                <span style={{ color: c("terminal.ansiBlue") }}>git:(</span>
                <span style={{ color: c("terminal.ansiRed") }}>main</span>
                <span style={{ color: c("terminal.ansiBlue") }}>)</span>{" "}
                <span style={{ color: c("terminal.ansiYellow") }}>✗</span> npm test
              </div>
              <div>
                <span style={{ color: c("terminal.ansiGreen") }}>✓</span> profile.test.js{" "}
                <span style={{ color: c("terminal.ansiBrightBlack") }}>(6 tests) 38ms</span>
              </div>
              <div>
                <span style={{ color: c("terminal.ansiRed") }}>✗</span> cache.test.js{" "}
                <span style={{ color: c("terminal.ansiMagenta") }}>expected 3 to be 2</span>
              </div>
              <div>
                <span style={{ color: c("terminal.ansiYellow") }}>⚠</span> 1 failed, 6 passed{" "}
                <span className="pv-term-cursor" style={{ background: c("terminalCursor.foreground") }} />
              </div>
            </div>
          </Region>
        </div>
      </div>

      {/* Status bar */}
      <Region
        group="statusBar"
        className="pv-status"
        style={{ background: c("statusBar.background"), color: c("statusBar.foreground"), borderTop: border("statusBar.border") }}
      >
        <span className="pv-remote" style={{ background: c("statusBarItem.remoteBackground"), color: c("statusBarItem.remoteForeground") }}>
          ≷
        </span>
        <span>⎇ main*</span>
        <span>⊗ 1 ⚠ 1</span>
        <span className="pv-spacer" />
        <span>Ln 14, Col 32</span>
        <span>Spaces: 2</span>
        <span>UTF-8</span>
        <span>JavaScript</span>
      </Region>

      {/* Notification toast */}
      <Region
        group="notifications"
        className="pv-toast"
        style={{ background: c("notifications.background"), color: c("notifications.foreground"), border: border("notifications.border") }}
      >
        <span style={{ color: c("editorInfo.foreground") }}>ⓘ</span> Tests finished with 1 failure.
        <span className="pv-toast-actions">
          <Region
            group="buttons"
            className="pv-button"
            style={{ background: c("button.background"), color: c("button.foreground") }}
          >
            Show
          </Region>
          <Region
            group="buttons"
            className="pv-button"
            style={{ background: c("button.secondaryBackground"), color: c("button.secondaryForeground") }}
          >
            Dismiss
          </Region>
        </span>
      </Region>
    </div>
  );
});
