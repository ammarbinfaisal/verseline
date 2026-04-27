"use client";

import { create } from "zustand";
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

  setThemePref: (p: ThemePref) => void;
  setPreferWarmInLight: (v: boolean) => void;

  rebindAction: (action: Action, binding: Binding) => void;
  resetBindings: () => void;
}

function initial() {
  const themePref = readPref();
  const preferWarmInLight = readPreferWarmInLight();
  return {
    themePref,
    preferWarmInLight,
    resolvedTheme: resolve(themePref, preferWarmInLight),
    bindings: readBindings(),
  };
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...initial(),

  setThemePref(p) {
    writePref(p);
    const resolved = resolve(p, get().preferWarmInLight);
    applyTheme(resolved);
    set({ themePref: p, resolvedTheme: resolved });
  },

  setPreferWarmInLight(v) {
    writePreferWarmInLight(v);
    const resolved = resolve(get().themePref, v);
    applyTheme(resolved);
    set({ preferWarmInLight: v, resolvedTheme: resolved });
  },

  rebindAction(action, binding) {
    const next = { ...get().bindings, [action]: binding };
    writeBindings(next);
    set({ bindings: next });
  },

  resetBindings() {
    writeBindings(DEFAULT_BINDINGS);
    set({ bindings: { ...DEFAULT_BINDINGS } });
  },
}));
