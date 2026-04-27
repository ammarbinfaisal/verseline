/**
 * Configurable keyboard shortcuts.
 *
 * - Default mapping ships in code (DEFAULT_BINDINGS).
 * - User overrides persist in localStorage.
 * - matchAction(event) returns the action id whose binding matches the event.
 *
 * See /design.md §10.
 */

export type Action =
  | "playPause"
  | "save"
  | "duplicateSegment"
  | "deleteSegment"
  | "seekForward1s"
  | "seekBack1s"
  | "seekForward5s"
  | "seekBack5s"
  | "nextSegment"
  | "prevSegment"
  | "splitSegment"
  | "toggleStylesPanel"
  | "togglePlacementsPanel"
  | "toggleFontsPanel"
  | "toggleSettingsPanel"
  | "focusSearch"
  | "escape";

/**
 * Stored as a string with a stable canonical form, e.g. "Mod+S", "Shift+ArrowRight".
 * "Mod" abstracts Cmd (Mac) / Ctrl (others).
 */
export type Binding = string;

export const DEFAULT_BINDINGS: Record<Action, Binding> = {
  playPause: "Space",
  save: "Mod+S",
  duplicateSegment: "Mod+D",
  deleteSegment: "Delete",
  seekForward1s: "ArrowRight",
  seekBack1s: "ArrowLeft",
  seekForward5s: "Shift+ArrowRight",
  seekBack5s: "Shift+ArrowLeft",
  nextSegment: "J",
  prevSegment: "K",
  splitSegment: "S",
  toggleStylesPanel: "1",
  togglePlacementsPanel: "2",
  toggleFontsPanel: "3",
  toggleSettingsPanel: "4",
  focusSearch: "/",
  escape: "Escape",
};

export const ACTION_LABELS: Record<Action, string> = {
  playPause: "Play / pause",
  save: "Save project",
  duplicateSegment: "Duplicate segment",
  deleteSegment: "Delete segment",
  seekForward1s: "Seek +1 second",
  seekBack1s: "Seek −1 second",
  seekForward5s: "Seek +5 seconds",
  seekBack5s: "Seek −5 seconds",
  nextSegment: "Next segment",
  prevSegment: "Previous segment",
  splitSegment: "Split segment at cursor",
  toggleStylesPanel: "Toggle Styles panel",
  togglePlacementsPanel: "Toggle Placements panel",
  toggleFontsPanel: "Toggle Fonts panel",
  toggleSettingsPanel: "Toggle Settings panel",
  focusSearch: "Focus search",
  escape: "Cancel / close",
};

/** Reserved bindings — cannot be rebound (would break the browser/system). */
const RESERVED = new Set(["Mod+R", "Mod+W", "Mod+T", "Mod+Q", "Tab", "F5"]);

const STORAGE_KEY = "verseline.shortcuts.v1";

export function readBindings(): Record<Action, Binding> {
  if (typeof window === "undefined") return DEFAULT_BINDINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_BINDINGS;
    const parsed = JSON.parse(raw) as Partial<Record<Action, Binding>>;
    return { ...DEFAULT_BINDINGS, ...parsed };
  } catch {
    return DEFAULT_BINDINGS;
  }
}

export function writeBindings(bindings: Record<Action, Binding>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bindings));
}

export function isReserved(binding: Binding): boolean {
  return RESERVED.has(binding);
}

/**
 * Convert a KeyboardEvent into the canonical binding string.
 */
export function eventToBinding(e: KeyboardEvent | React.KeyboardEvent): Binding {
  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) parts.push("Mod");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  // Normalize key:
  let key = e.key;
  if (key === " ") key = "Space";
  else if (key.length === 1) key = key.toUpperCase();
  parts.push(key);
  return parts.join("+");
}

/**
 * Match an event against a bindings map and return the matching action.
 * Returns null when no action matches.
 */
export function matchAction(
  e: KeyboardEvent | React.KeyboardEvent,
  bindings: Record<Action, Binding> = readBindings(),
): Action | null {
  const eventBinding = eventToBinding(e);
  for (const [action, binding] of Object.entries(bindings) as [Action, Binding][]) {
    if (binding === eventBinding) return action;
  }
  return null;
}

export function describeBinding(binding: Binding, isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform)): string {
  return binding
    .split("+")
    .map((part) => {
      if (part === "Mod") return isMac ? "⌘" : "Ctrl";
      if (part === "Shift") return isMac ? "⇧" : "Shift";
      if (part === "Alt") return isMac ? "⌥" : "Alt";
      if (part === "Space") return "Space";
      if (part === "ArrowRight") return "→";
      if (part === "ArrowLeft") return "←";
      if (part === "ArrowUp") return "↑";
      if (part === "ArrowDown") return "↓";
      return part;
    })
    .join(isMac ? "" : "+");
}
