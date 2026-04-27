/**
 * Theme resolution — single source of truth.
 *
 * Three themes: "warm", "light", "dark".
 * User preference is stored as one of:
 *   - "system"   → resolves via prefers-color-scheme + preferWarmInLight flag
 *   - "light"    → forced light
 *   - "warm"     → forced warm (still a light-luminance theme)
 *   - "dark"     → forced dark
 *
 * Plus a separate boolean: preferWarmInLight. When pref="system" and the
 * OS reports light, this flag picks "warm" over "light". Stored alongside.
 *
 * See /design.md §2.3.
 */

export type Theme = "light" | "warm" | "dark";
export type ThemePref = "system" | Theme;

const STORAGE_KEY_THEME = "verseline.theme.v1";
const STORAGE_KEY_WARM_IN_LIGHT = "verseline.theme.preferWarmInLight.v1";

export function readPref(): ThemePref {
  if (typeof window === "undefined") return "system";
  const v = window.localStorage.getItem(STORAGE_KEY_THEME);
  if (v === "system" || v === "light" || v === "warm" || v === "dark") return v;
  return "system";
}

export function readPreferWarmInLight(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY_WARM_IN_LIGHT) === "true";
}

export function writePref(p: ThemePref): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY_THEME, p);
}

export function writePreferWarmInLight(v: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY_WARM_IN_LIGHT, v ? "true" : "false");
}

export function resolve(pref: ThemePref, preferWarmInLight: boolean): Theme {
  if (pref !== "system") return pref;
  if (typeof window === "undefined") return "light";
  const dark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  if (dark) return "dark";
  return preferWarmInLight ? "warm" : "light";
}

export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
}

/**
 * Inline script string injected into <head> via next/script "beforeInteractive"
 * to set data-theme synchronously before first paint, eliminating FOUC.
 */
export const themeBootstrapScript = `
(function () {
  try {
    var pref = localStorage.getItem(${JSON.stringify(STORAGE_KEY_THEME)}) || "system";
    var warm = localStorage.getItem(${JSON.stringify(STORAGE_KEY_WARM_IN_LIGHT)}) === "true";
    var theme;
    if (pref === "light" || pref === "warm" || pref === "dark") {
      theme = pref;
    } else {
      var mq = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
      theme = (mq && mq.matches) ? "dark" : (warm ? "warm" : "light");
    }
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
`.trim();
