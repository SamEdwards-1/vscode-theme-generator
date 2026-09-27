import type { ThemeType } from "../stores/types";

/**
 * VS Code's built-in defaults (from its color registry) for keys the preview
 * and contrast checks read, so unset keys look the way VS Code would show them.
 * "@key" means "same as that key".
 */
const DEFAULTS: Record<string, [dark: string, light: string]> = {
  foreground: ["#cccccc", "#616161"],
  focusBorder: ["#007fd4", "#0090f1"],
  "widget.shadow": ["#0000005c", "#00000029"],
  "editor.background": ["#1e1e1e", "#ffffff"],
  "editor.foreground": ["#bbbbbb", "#333333"],
  "editor.selectionBackground": ["#264f78", "#add6ff"],
  "editor.findMatchHighlightBackground": ["#ea5c0055", "#ea5c0055"],
  "editorCursor.foreground": ["#aeafad", "#000000"],
  "editorLineNumber.foreground": ["#858585", "#237893"],
  "editorLineNumber.activeForeground": ["#c6c6c6", "#0b216f"],
  "editorIndentGuide.background1": ["#404040", "#d3d3d3"],
  "editorWarning.foreground": ["#cca700", "#bf8803"],
  "editorInfo.foreground": ["#3794ff", "#1a85ff"],
  "editorGutter.modifiedBackground": ["#1b81a8", "#2090d3"],
  "editorGutter.addedBackground": ["#487e02", "#48985d"],
  "editorWidget.background": ["#252526", "#f3f3f3"],
  "editorWidget.foreground": ["@foreground", "@foreground"],
  "editorSuggestWidget.background": ["@editorWidget.background", "@editorWidget.background"],
  "editorSuggestWidget.border": ["#454545", "#c8c8c8"],
  "editorSuggestWidget.selectedBackground": ["#04395e", "#0060c0"],
  "titleBar.activeBackground": ["#3c3c3c", "#dddddd"],
  "titleBar.activeForeground": ["#cccccc", "#333333"],
  "activityBar.background": ["#333333", "#2c2c2c"],
  "activityBar.foreground": ["#ffffff", "#ffffff"],
  "activityBar.inactiveForeground": ["#ffffff66", "#ffffff66"],
  "activityBar.activeBorder": ["@activityBar.foreground", "@activityBar.foreground"],
  "activityBarBadge.background": ["#007acc", "#007acc"],
  "activityBarBadge.foreground": ["#ffffff", "#ffffff"],
  "sideBar.background": ["#252526", "#f3f3f3"],
  "sideBar.foreground": ["@foreground", "@foreground"],
  "sideBarTitle.foreground": ["@sideBar.foreground", "@sideBar.foreground"],
  "sideBarSectionHeader.background": ["#80808033", "#80808033"],
  "sideBarSectionHeader.foreground": ["@sideBar.foreground", "@sideBar.foreground"],
  "list.activeSelectionBackground": ["#04395e", "#0060c0"],
  "list.activeSelectionForeground": ["#ffffff", "#ffffff"],
  "list.focusOutline": ["@focusBorder", "@focusBorder"],
  "gitDecoration.modifiedResourceForeground": ["#e2c08d", "#895503"],
  "gitDecoration.deletedResourceForeground": ["#c74e39", "#ad0707"],
  "gitDecoration.untrackedResourceForeground": ["#73c991", "#007100"],
  "gitDecoration.ignoredResourceForeground": ["#8c8c8c", "#8e8e90"],
  "editorGroupHeader.tabsBackground": ["#252526", "#f3f3f3"],
  "tab.activeBackground": ["@editor.background", "@editor.background"],
  "tab.inactiveBackground": ["#2d2d2d", "#ececec"],
  "tab.activeForeground": ["#ffffff", "#333333"],
  "tab.inactiveForeground": ["#ffffff80", "#33333380"],
  "tab.border": ["#252526", "#f3f3f3"],
  "breadcrumb.background": ["@editor.background", "@editor.background"],
  "breadcrumb.foreground": ["#cccccccc", "#616161cc"],
  "breadcrumb.focusForeground": ["#e0e0e0", "#4e4e4e"],
  "scrollbarSlider.background": ["#79797966", "#64646466"],
  "panel.background": ["@editor.background", "@editor.background"],
  "panel.border": ["#80808059", "#80808059"],
  "panelTitle.activeForeground": ["#e7e7e7", "#424242"],
  "panelTitle.inactiveForeground": ["#e7e7e799", "#42424275"],
  "panelTitle.activeBorder": ["@panelTitle.activeForeground", "@panelTitle.activeForeground"],
  "terminal.background": ["@panel.background", "@panel.background"],
  "terminal.foreground": ["#cccccc", "#333333"],
  "terminalCursor.foreground": ["@terminal.foreground", "@terminal.foreground"],
  "terminal.ansiRed": ["#cd3131", "#cd3131"],
  "terminal.ansiGreen": ["#0dbc79", "#00bc00"],
  "terminal.ansiYellow": ["#e5e510", "#949800"],
  "terminal.ansiBlue": ["#2472c8", "#0451a5"],
  "terminal.ansiMagenta": ["#bc3fbc", "#bc05bc"],
  "terminal.ansiCyan": ["#11a8cd", "#0598bc"],
  "terminal.ansiBrightBlack": ["#666666", "#666666"],
  "statusBar.background": ["#007acc", "#007acc"],
  "statusBar.foreground": ["#ffffff", "#ffffff"],
  "statusBarItem.remoteBackground": ["#16825d", "#16825d"],
  "statusBarItem.remoteForeground": ["#ffffff", "#ffffff"],
  "notifications.background": ["@editorWidget.background", "@editorWidget.background"],
  "notifications.foreground": ["@editorWidget.foreground", "@editorWidget.foreground"],
  "notifications.border": ["#303031", "#e7e7e7"],
  "button.background": ["#0e639c", "#007acc"],
  "button.foreground": ["#ffffff", "#ffffff"],
  "button.secondaryBackground": ["#3a3d41", "#5f6a79"],
  "button.secondaryForeground": ["#ffffff", "#ffffff"],
  "input.background": ["#3c3c3c", "#ffffff"],
  "input.foreground": ["@foreground", "@foreground"],
};

/**
 * Looks up a key: explicit colors first, then VS Code's default for the theme
 * type (following "@key" references). Returns null when VS Code draws nothing.
 */
export function colorWithDefault(
  explicit: (key: string) => string | null,
  key: string,
  type: ThemeType,
  depth = 0,
): string | null {
  const own = explicit(key);
  if (own) return own;
  const def = DEFAULTS[key]?.[type === "dark" ? 0 : 1];
  if (!def || depth > 5) return null;
  return def.startsWith("@") ? colorWithDefault(explicit, def.slice(1), type, depth + 1) : def;
}
