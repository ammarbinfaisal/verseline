"use client";

import { useState } from "react";
import { useSettingsStore } from "@/stores/settings-store";
import {
  ACTION_LABELS,
  DEFAULT_BINDINGS,
  describeBinding,
  eventToBinding,
  isReserved,
  type Action,
  type Binding,
} from "@/lib/shortcuts";
import { Button, Kbd, toast } from "@/components/ui";

const THEME_OPTIONS: Array<{ id: "system" | "light" | "warm" | "dark"; label: string; hint: string }> = [
  { id: "system", label: "System", hint: "Follows OS appearance" },
  { id: "light", label: "Light", hint: "Cool paper, daytime" },
  { id: "warm", label: "Warm", hint: "Sepia paper, long sessions" },
  { id: "dark", label: "Dark", hint: "Deep cool, night editing" },
];

export default function SettingsPage() {
  const themePref = useSettingsStore((s) => s.themePref);
  const preferWarmInLight = useSettingsStore((s) => s.preferWarmInLight);
  const resolved = useSettingsStore((s) => s.resolvedTheme);
  const setThemePref = useSettingsStore((s) => s.setThemePref);
  const setPreferWarmInLight = useSettingsStore((s) => s.setPreferWarmInLight);

  const bindings = useSettingsStore((s) => s.bindings);
  const rebindAction = useSettingsStore((s) => s.rebindAction);
  const resetBindings = useSettingsStore((s) => s.resetBindings);

  const [capturing, setCapturing] = useState<Action | null>(null);

  const captureKey = (e: React.KeyboardEvent) => {
    if (!capturing) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.key === "Escape") {
      setCapturing(null);
      return;
    }
    // ignore standalone modifiers
    if (["Meta", "Control", "Alt", "Shift"].includes(e.key)) return;
    const binding = eventToBinding(e);
    if (isReserved(binding)) {
      toast.error(`${describeBinding(binding)} is reserved by the browser`);
      return;
    }
    rebindAction(capturing, binding);
    setCapturing(null);
    toast.success(`${ACTION_LABELS[capturing]} → ${describeBinding(binding)}`);
  };

  return (
    <div className="max-w-3xl mx-auto px-8 py-12">
      <header className="mb-10 pb-6 border-b border-[var(--border)]">
        <p className="text-[var(--text-fs-1)] uppercase tracking-[0.18em] text-[var(--text-muted)] font-mono mb-2">
          Preferences
        </p>
        <h1
          className="font-display text-[var(--text-fs-7)]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Settings
        </h1>
      </header>

      {/* Theme */}
      <section className="mb-12">
        <h2 className="text-[var(--text-fs-5)] font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>
          Theme
        </h2>
        <p className="text-[var(--text-fs-2)] text-[var(--text-muted)] mb-6">
          Currently showing <span className="font-mono text-[var(--text)]">{resolved}</span>
          {themePref === "system" && (
            <> · resolved from {preferWarmInLight ? "warm-or-dark system pref" : "light-or-dark system pref"}</>
          )}
        </p>

        <div role="radiogroup" aria-labelledby="theme-radiogroup" className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {THEME_OPTIONS.map((opt) => {
            const active = themePref === opt.id;
            return (
              <button
                key={opt.id}
                role="radio"
                aria-checked={active}
                data-testid={`theme-${opt.id}`}
                onClick={() => setThemePref(opt.id)}
                className={[
                  "text-left px-4 py-3 rounded-md border transition-colors",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]",
                  active
                    ? "border-[var(--accent-cool)] bg-[color-mix(in_srgb,var(--accent-cool)_8%,transparent)]"
                    : "border-[var(--border)] hover:border-[var(--border-strong)]",
                ].join(" ")}
              >
                <div className="text-[var(--text-fs-3)] font-semibold text-[var(--text)] flex items-center gap-2">
                  {opt.label}
                  {active && (
                    <span aria-hidden="true" className="text-[var(--accent-cool)]">●</span>
                  )}
                </div>
                <div className="text-[var(--text-fs-1)] text-[var(--text-muted)] mt-0.5">{opt.hint}</div>
              </button>
            );
          })}
        </div>

        <label className="flex items-center gap-3 cursor-pointer select-none text-[var(--text-fs-2)]">
          <input
            type="checkbox"
            checked={preferWarmInLight}
            onChange={(e) => setPreferWarmInLight(e.target.checked)}
            className="h-4 w-4 accent-[var(--accent-cool)]"
            data-testid="prefer-warm-in-light"
          />
          <span>
            <span className="text-[var(--text)]">Prefer warm in light mode</span>
            <span className="text-[var(--text-muted)] ml-2">
              · when System theme resolves to light, use warm sepia
            </span>
          </span>
        </label>
      </section>

      {/* Shortcuts */}
      <section>
        <div className="flex items-end justify-between mb-1">
          <h2 className="text-[var(--text-fs-5)] font-semibold" style={{ fontFamily: "var(--font-display)" }}>
            Keyboard shortcuts
          </h2>
          <Button size="sm" variant="ghost" onClick={resetBindings} data-testid="reset-shortcuts">
            Reset to defaults
          </Button>
        </div>
        <p className="text-[var(--text-fs-2)] text-[var(--text-muted)] mb-6">
          Click <em>Rebind</em> on a row, then press the new combination. ESC cancels.
        </p>

        <div className="rounded-md border border-[var(--border)] overflow-hidden" data-testid="shortcut-list">
          {(Object.keys(DEFAULT_BINDINGS) as Action[]).map((action, i) => {
            const binding = bindings[action];
            const isCapturing = capturing === action;
            return (
              <div
                key={action}
                className={[
                  "flex items-center px-4 py-2.5 gap-4",
                  i > 0 ? "border-t border-[var(--divider)]" : "",
                  isCapturing ? "bg-[color-mix(in_srgb,var(--accent-cool)_12%,transparent)]" : "",
                ].join(" ")}
                data-testid={`shortcut-row-${action}`}
              >
                <span className="flex-1 text-[var(--text-fs-3)] text-[var(--text)]">
                  {ACTION_LABELS[action]}
                </span>
                {isCapturing ? (
                  <input
                    autoFocus
                    type="text"
                    readOnly
                    onKeyDown={captureKey}
                    placeholder="Press a key combination…"
                    className="bg-[var(--surface-2)] text-[var(--text)] font-mono text-[var(--text-fs-2)] px-3 py-1 rounded-sm border border-[var(--accent-cool)] outline-none w-48 text-center"
                    data-testid={`capture-${action}`}
                  />
                ) : (
                  <Kbd>{describeBinding(binding)}</Kbd>
                )}
                <Button
                  size="sm"
                  variant={isCapturing ? "primary" : "ghost"}
                  onClick={() =>
                    isCapturing ? setCapturing(null) : setCapturing(action)
                  }
                  data-testid={`rebind-${action}`}
                >
                  {isCapturing ? "Cancel" : "Rebind"}
                </Button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
