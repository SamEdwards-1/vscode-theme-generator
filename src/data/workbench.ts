import type { ColorAssignment, ThemeType } from "../stores/types";

/**
 * [VS Code color key, default source, alpha, description]
 * The source is a palette id or #hex, optionally with "@+N" / "@-N": a derived
 * color N% lighter (dark themes) or darker (light themes) than the source.
 */
type KeyDef = [key: string, source: string, alpha?: number, description?: string];

interface DefaultSpec {
  source: string;
  alpha: number;
  /** Lightness offset in "emphasis" direction; flipped for light themes. */
  emphasis: number;
}

export interface WorkbenchKey {
  key: string;
  description?: string;
  spec: DefaultSpec;
}

function parseSpec(source: string, alpha: number): DefaultSpec {
  const [base, offset] = source.split("@");
  return { source: base, alpha, emphasis: offset ? Number(offset) / 100 : 0 };
}

export function defaultAssignment(k: WorkbenchKey, type: ThemeType): ColorAssignment {
  const { source, alpha, emphasis } = k.spec;
  const dl = type === "light" ? -emphasis : emphasis;
  return dl ? { source, alpha, dl } : { source, alpha };
}

export interface WorkbenchGroup {
  id: string;
  label: string;
  keys: WorkbenchKey[];
}

const GROUPS: [id: string, label: string, keys: KeyDef[]][] = [
  ["general", "General", [
    ["foreground", "fg", 1, "Overall foreground color"],
    ["descriptionForeground", "fgMuted"],
    ["focusBorder", "accent", 1, "Border of focused elements"],
    ["selection.background", "accent", 0.4, "Text selection in inputs"],
    ["widget.shadow", "#000000", 0.35],
    ["icon.foreground", "fg"],
    ["errorForeground", "red"],
    ["textLink.foreground", "blue"],
    ["textLink.activeForeground", "cyan"],
  ]],
  ["editor", "Editor", [
    ["editor.background", "bg"],
    ["editor.foreground", "fg"],
    ["editorLineNumber.foreground", "fgMuted"],
    ["editorLineNumber.activeForeground", "fg"],
    ["editorCursor.foreground", "accent"],
    ["editor.selectionBackground", "selection"],
    ["editor.inactiveSelectionBackground", "selection", 0.6],
    ["editor.lineHighlightBackground", "bgHighlight"],
    ["editor.wordHighlightBackground", "fg", 0.12],
    ["editor.findMatchBackground", "yellow", 0.4],
    ["editor.findMatchHighlightBackground", "yellow", 0.2],
    ["editorIndentGuide.background1", "fgMuted", 0.3],
    ["editorIndentGuide.activeBackground1", "fgMuted", 0.8],
    ["editorWhitespace.foreground", "fgMuted", 0.4],
    ["editorBracketMatch.background", "accent", 0.2],
    ["editorBracketMatch.border", "accent", 0.6],
    ["editorGutter.background", "bg"],
    ["editorError.foreground", "red"],
    ["editorWarning.foreground", "yellow"],
    ["editorInfo.foreground", "blue"],
  ]],
  ["activityBar", "Activity Bar", [
    ["activityBar.background", "bgAlt"],
    ["activityBar.foreground", "fg"],
    ["activityBar.inactiveForeground", "fgMuted"],
    ["activityBar.border", "border"],
    ["activityBar.activeBorder", "accent"],
    ["activityBarBadge.background", "accent"],
    ["activityBarBadge.foreground", "#ffffff"],
  ]],
  ["sideBar", "Side Bar", [
    ["sideBar.background", "bgAlt"],
    ["sideBar.foreground", "fg"],
    ["sideBar.border", "border"],
    ["sideBarTitle.foreground", "fg"],
    ["sideBarSectionHeader.background", "bgAlt@+2"],
    ["sideBarSectionHeader.foreground", "fg"],
    ["sideBarSectionHeader.border", "border"],
    ["list.activeSelectionBackground", "selection"],
    ["list.activeSelectionForeground", "fg"],
    ["list.inactiveSelectionBackground", "bgHighlight"],
    ["list.hoverBackground", "bgAlt@+4"],
    ["list.focusOutline", "accent"],
    ["list.highlightForeground", "blue"],
  ]],
  ["statusBar", "Status Bar", [
    ["statusBar.background", "accent"],
    ["statusBar.foreground", "#ffffff"],
    ["statusBar.border", "accent"],
    ["statusBarItem.hoverBackground", "#ffffff", 0.12],
    ["statusBarItem.remoteBackground", "accent"],
    ["statusBarItem.remoteForeground", "#ffffff"],
    ["statusBar.debuggingBackground", "orange"],
    ["statusBar.debuggingForeground", "#ffffff"],
    ["statusBar.noFolderBackground", "purple"],
  ]],
  ["titleBar", "Title Bar", [
    ["titleBar.activeBackground", "bgAlt"],
    ["titleBar.activeForeground", "fg"],
    ["titleBar.inactiveBackground", "bgAlt"],
    ["titleBar.inactiveForeground", "fgMuted"],
    ["titleBar.border", "border"],
  ]],
  ["tabs", "Tabs", [
    ["editorGroupHeader.tabsBackground", "bgAlt"],
    ["editorGroupHeader.tabsBorder", "border"],
    ["tab.activeBackground", "bg"],
    ["tab.activeForeground", "fg"],
    ["tab.activeBorderTop", "accent"],
    ["tab.inactiveBackground", "bgAlt"],
    ["tab.inactiveForeground", "fgMuted"],
    ["tab.hoverBackground", "bgAlt@+4"],
    ["tab.border", "border"],
    ["tab.unfocusedActiveForeground", "fg", 0.7],
  ]],
  ["breadcrumbs", "Breadcrumbs", [
    ["breadcrumb.background", "bg"],
    ["breadcrumb.foreground", "fgMuted"],
    ["breadcrumb.focusForeground", "fg"],
    ["breadcrumb.activeSelectionForeground", "fg"],
  ]],
  ["buttons", "Buttons", [
    ["button.background", "accent"],
    ["button.foreground", "#ffffff"],
    ["button.hoverBackground", "accent@+6"],
    ["button.secondaryBackground", "selection"],
    ["button.secondaryForeground", "fg"],
    ["checkbox.background", "bgHighlight"],
    ["checkbox.border", "border"],
  ]],
  ["inputs", "Inputs", [
    ["input.background", "bgHighlight"],
    ["input.foreground", "fg"],
    ["input.border", "border"],
    ["input.placeholderForeground", "fgMuted"],
    ["inputOption.activeBorder", "accent"],
    ["dropdown.background", "bgAlt@+3"],
    ["dropdown.foreground", "fg"],
    ["dropdown.border", "border"],
  ]],
  ["panel", "Panel", [
    ["panel.background", "bgAlt"],
    ["panel.border", "border"],
    ["panelTitle.activeForeground", "fg"],
    ["panelTitle.inactiveForeground", "fgMuted"],
    ["panelTitle.activeBorder", "accent"],
  ]],
  ["terminal", "Terminal", [
    ["terminal.background", "bgAlt"],
    ["terminal.foreground", "fg"],
    ["terminalCursor.foreground", "accent"],
    ["terminal.ansiBlack", "bgHighlight"],
    ["terminal.ansiRed", "red"],
    ["terminal.ansiGreen", "green"],
    ["terminal.ansiYellow", "yellow"],
    ["terminal.ansiBlue", "blue"],
    ["terminal.ansiMagenta", "purple"],
    ["terminal.ansiCyan", "cyan"],
    ["terminal.ansiWhite", "fg"],
    ["terminal.ansiBrightBlack", "fgMuted"],
    ["terminal.ansiBrightRed", "red"],
    ["terminal.ansiBrightGreen", "green"],
    ["terminal.ansiBrightYellow", "yellow"],
    ["terminal.ansiBrightBlue", "blue"],
    ["terminal.ansiBrightMagenta", "purple"],
    ["terminal.ansiBrightCyan", "cyan"],
    ["terminal.ansiBrightWhite", "fg"],
  ]],
  ["scrollbar", "Scrollbar", [
    ["scrollbar.shadow", "#000000", 0.3],
    ["scrollbarSlider.background", "fgMuted", 0.2],
    ["scrollbarSlider.hoverBackground", "fgMuted", 0.35],
    ["scrollbarSlider.activeBackground", "fgMuted", 0.5],
  ]],
  ["widgets", "Widgets", [
    ["editorWidget.background", "bgAlt"],
    ["editorWidget.border", "border"],
    ["editorSuggestWidget.background", "bgAlt"],
    ["editorSuggestWidget.border", "border"],
    ["editorSuggestWidget.selectedBackground", "selection"],
    ["editorHoverWidget.background", "bgAlt@+2"],
    ["editorHoverWidget.border", "border"],
    ["quickInput.background", "bgAlt@+2"],
    ["badge.background", "accent"],
    ["badge.foreground", "#ffffff"],
  ]],
  ["notifications", "Notifications", [
    ["notifications.background", "bgAlt"],
    ["notifications.foreground", "fg"],
    ["notifications.border", "border"],
    ["notificationCenterHeader.background", "bgAlt@+4"],
  ]],
  ["git", "Git Decorations", [
    ["gitDecoration.modifiedResourceForeground", "yellow"],
    ["gitDecoration.deletedResourceForeground", "red"],
    ["gitDecoration.untrackedResourceForeground", "green"],
    ["gitDecoration.ignoredResourceForeground", "fgMuted"],
    ["gitDecoration.conflictingResourceForeground", "orange"],
    ["editorGutter.modifiedBackground", "blue"],
    ["editorGutter.addedBackground", "green"],
    ["editorGutter.deletedBackground", "red"],
  ]],
];

export const WORKBENCH_GROUPS: WorkbenchGroup[] = GROUPS.map(([id, label, keys]) => ({
  id,
  label,
  keys: keys.map(([key, source, alpha = 1, description]) => ({
    key,
    description,
    spec: parseSpec(source, alpha),
  })),
}));

export const KNOWN_KEYS = new Set(WORKBENCH_GROUPS.flatMap((g) => g.keys.map((k) => k.key)));

export function findWorkbenchKey(key: string): WorkbenchKey | undefined {
  for (const g of WORKBENCH_GROUPS) {
    const k = g.keys.find((x) => x.key === key);
    if (k) return k;
  }
  return undefined;
}

export function defaultWorkbench(type: ThemeType): Record<string, ColorAssignment> {
  const out: Record<string, ColorAssignment> = {};
  for (const g of WORKBENCH_GROUPS) {
    for (const k of g.keys) out[k.key] = defaultAssignment(k, type);
  }
  return out;
}
