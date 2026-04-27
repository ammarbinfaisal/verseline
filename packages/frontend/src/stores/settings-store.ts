"use client";

import { create } from "zustand";
import { api } from "@/lib/api";
import {
  applyTheme,
  readPref,
  readPreferWarmInLight,
  resolve,
  writePref,
  writePreferWarmInLight,
  type Theme,
  type ThemePref,
} from "@/lib/theme";
import {
  DEFAULT_BINDINGS,
  readBindings,
  writeBindings,
  type Action,
  type Binding,
} from "@/lib/shortcuts";

interface SettingsState {
  themePref: ThemePref;
  preferWarmInLight: boolean;
  resolvedTheme: Theme;
  bindings: Record<Action, Binding>;

  /** Has the server-prefs hydration completed at least once this session? */
  hydrated: boolean;

  setThemePref: (p: ThemePref) => void;
  setPreferWarmInLight: (v: boolean) => void;
  rebindAction: (action: Action, binding: Binding) => void;
  resetBindings: () => void;

  /**
   * Hydrate from /me/prefs after authentication. Server values overwrite
   * local on first load *unless* this browser has never seen the server
   * before — in which case any localStorage values are pushed up so the
   * user keeps the prefs they configured before we shipped server sync.
   *
   * See /design.md §V2.6.
   */
  hydrateFromServer: () => Promise<void>;
}

const HYDRATION_FLAG = "verseline.settings.hydrated.v1";

function initial() {
  const themePref = readPref();
  const preferWarmInLight = readPreferWarmInLight();
  return {
    themePref,
    preferWarmInLight,
    resolvedTheme: resolve(themePref, preferWarmInLight),
    bindings: readBindings(),
    hydrated: false,
  };
}

// ---- Debounced server write ----
//
// The setters call this on every change. The trailing call wins; we don't
// stream every keystroke to the server. `flush` is called by the setter
// directly so that rapid changes coalesce into one PUT.

let pendingPatch: Partial<{
  theme: ThemePref;
  preferWarmInLight: boolean;
  shortcuts: Record<string, string>;
}> = {};
let pendingTimer: ReturnType<typeof setTimeout> | null = null;

function flushSoon(patch: typeof pendingPatch) {
  pendingPatch = { ...pendingPatch, ...patch };
  if (pendingTimer) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => {
    const toSend = pendingPatch;
    pendingPatch = {};
    pendingTimer = null;
    // Fire and forget — failure is logged but doesn't surface to the user.
    api.me
      .putPrefs({
        theme: toSend.theme as MePrefsTheme | undefined,
        preferWarmInLight: toSend.preferWarmInLight,
        shortcuts: toSend.shortcuts,
      })
      .catch((err) => {
        console.warn("[settings-store] putPrefs failed:", err);
      });
  }, 400);
}

type MePrefsTheme = "system" | "light" | "warm" | "dark";

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...initial(),

  setThemePref(p) {
    writePref(p);
    const resolved = resolve(p, get().preferWarmInLight);
    applyTheme(resolved);
    set({ themePref: p, resolvedTheme: resolved });
    flushSoon({ theme: p });
  },

  setPreferWarmInLight(v) {
    writePreferWarmInLight(v);
    const resolved = resolve(get().themePref, v);
    applyTheme(resolved);
    set({ preferWarmInLight: v, resolvedTheme: resolved });
    flushSoon({ preferWarmInLight: v });
  },

  rebindAction(action, binding) {
    const next = { ...get().bindings, [action]: binding };
    writeBindings(next);
    set({ bindings: next });
    // Only ship overrides; leave defaults out so the server payload stays small.
    const overrides: Record<string, string> = {};
    for (const k of Object.keys(next) as Action[]) {
      if (next[k] !== DEFAULT_BINDINGS[k]) overrides[k] = next[k];
    }
    flushSoon({ shortcuts: overrides });
  },

  resetBindings() {
    writeBindings(DEFAULT_BINDINGS);
    set({ bindings: { ...DEFAULT_BINDINGS } });
    flushSoon({ shortcuts: {} });
  },

  async hydrateFromServer() {
    if (typeof window === "undefined") return;
    if (get().hydrated) return;

    const seenServerBefore =
      window.localStorage.getItem(HYDRATION_FLAG) === "true";

    try {
      const remote = await api.me.getPrefs();

      if (!seenServerBefore) {
        // First contact with server. Push local values up so the user keeps
        // the prefs they had before we shipped server sync — but only if
        // the local values differ from their respective defaults / from
        // what the server returned (defensive — usually a no-op).
        const local = get();
        const localOverrides: Record<string, string> = {};
        for (const k of Object.keys(local.bindings) as Action[]) {
          if (local.bindings[k] !== DEFAULT_BINDINGS[k]) {
            localOverrides[k] = local.bindings[k];
          }
        }
        const localDiffersFromRemote =
          local.themePref !== remote.theme ||
          local.preferWarmInLight !== remote.preferWarmInLight ||
          JSON.stringify(localOverrides) !== JSON.stringify(remote.shortcuts);

        if (localDiffersFromRemote) {
          await api.me.putPrefs({
            theme: local.themePref as MePrefsTheme,
            preferWarmInLight: local.preferWarmInLight,
            shortcuts: localOverrides,
          });
          window.localStorage.setItem(HYDRATION_FLAG, "true");
          set({ hydrated: true });
          return;
        }
        window.localStorage.setItem(HYDRATION_FLAG, "true");
      }

      // Server wins on subsequent loads.
      const merged: Record<Action, Binding> = { ...DEFAULT_BINDINGS };
      for (const [k, v] of Object.entries(remote.shortcuts)) {
        if (k in DEFAULT_BINDINGS) merged[k as Action] = v;
      }
      writePref(remote.theme);
      writePreferWarmInLight(remote.preferWarmInLight);
      writeBindings(merged);
      const resolved = resolve(remote.theme, remote.preferWarmInLight);
      applyTheme(resolved);
      set({
        themePref: remote.theme,
        preferWarmInLight: remote.preferWarmInLight,
        resolvedTheme: resolved,
        bindings: merged,
        hydrated: true,
      });
    } catch (err) {
      console.warn("[settings-store] hydrateFromServer failed:", err);
      set({ hydrated: true }); // don't retry on every render
    }
  },
}));
