import { makeAutoObservable } from "mobx";

export type SidebarTab = "palette" | "colors" | "syntax";

export class UiStore {
  tab: SidebarTab = "palette";
  openGroups = new Set<string>(["general"]);
  editingKey: string | null = null;
  /** Group scrolled into view after a click in the preview. */
  focusedGroup: string | null = null;
  sidebarWidth = 400;
  pickColors = false;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  setTab(tab: SidebarTab) {
    this.tab = tab;
  }

  setSidebarWidth(width: number) {
    this.sidebarWidth = Math.max(350, Math.min(720, width));
  }

  setPickColors(pick: boolean) {
    this.pickColors = pick;
  }

  toggleGroup(id: string) {
    if (this.openGroups.has(id)) this.openGroups.delete(id);
    else this.openGroups.add(id);
  }

  setEditing(key: string | null) {
    this.editingKey = key;
  }

  /** Opens the Colors tab at a workbench group (used by preview clicks). */
  focusGroup(id: string) {
    this.tab = id === "syntax" ? "syntax" : "colors";
    if (id !== "syntax") this.openGroups.add(id);
    this.focusedGroup = id;
  }

  clearFocus() {
    this.focusedGroup = null;
  }
}

export const ui = new UiStore();
