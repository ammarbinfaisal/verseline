"use client";

import { useCallback, useRef, useState } from "react";
import type { Placement, Anchor } from "@verseline/shared";
import { Field, Input } from "@/components/ui";

interface FreeformPlacementEditorProps {
  /** Project canvas — used to set the editor's aspect ratio */
  canvas: { width: number; height: number };
  value: Placement;
  onChange: (next: Placement) => void;
}

type SnapMode = "off" | "12" | "8" | "4";

const ANCHORS: { id: Anchor; label: string; x: number; y: number }[] = [
  { id: "top_left",      label: "↖", x: 0,    y: 0    },
  { id: "top_center",    label: "↑", x: 0.5,  y: 0    },
  { id: "top_right",     label: "↗", x: 1,    y: 0    },
  { id: "center_left",   label: "←", x: 0,    y: 0.5  },
  { id: "center",        label: "·", x: 0.5,  y: 0.5  },
  { id: "center_right",  label: "→", x: 1,    y: 0.5  },
  { id: "bottom_left",   label: "↙", x: 0,    y: 1    },
  { id: "bottom_center", label: "↓", x: 0.5,  y: 1    },
  { id: "bottom_right",  label: "↘", x: 1,    y: 1    },
];

function snapValue(v: number, mode: SnapMode): number {
  if (mode === "off") return v;
  const n = Number(mode); // 12 / 8 / 4
  return Math.round(v * n) / n;
}

export function FreeformPlacementEditor({ canvas, value, onChange }: FreeformPlacementEditorProps) {
  const [snap, setSnap] = useState<SnapMode>("off");
  const surfaceRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<boolean>(false);

  // Resolve current x/y to render the pin. Free-form takes precedence; fall back
  // to the legacy anchor as a normalized point.
  const resolved = (() => {
    if (value.x != null && value.y != null) return { x: value.x, y: value.y };
    const a = ANCHORS.find((a) => a.id === value.anchor) ?? ANCHORS[7];
    return { x: a.x, y: a.y };
  })();

  const setXY = useCallback(
    (xRaw: number, yRaw: number) => {
      const x = Math.max(0, Math.min(1, snapValue(xRaw, snap)));
      const y = Math.max(0, Math.min(1, snapValue(yRaw, snap)));
      onChange({ ...value, x, y });
    },
    [snap, value, onChange],
  );

  const handlePointer = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!surfaceRef.current) return;
      const rect = surfaceRef.current.getBoundingClientRect();
      const xRaw = (e.clientX - rect.left) / rect.width;
      const yRaw = (e.clientY - rect.top) / rect.height;
      setXY(xRaw, yRaw);
    },
    [setXY],
  );

  const handleQuickAnchor = useCallback(
    (a: { id: Anchor; x: number; y: number }) => {
      onChange({ ...value, anchor: a.id, x: a.x, y: a.y });
    },
    [onChange, value],
  );

  const aspect = canvas.width / canvas.height || 16 / 9;
  const xPct = (resolved.x * 100).toFixed(1);
  const yPct = (resolved.y * 100).toFixed(1);

  return (
    <div className="flex flex-col gap-4" data-testid="freeform-placement">
      {/* Stage — aspect-ratio matches the project canvas */}
      <div
        ref={surfaceRef}
        onPointerDown={(e) => {
          draggingRef.current = true;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          handlePointer(e);
        }}
        onPointerMove={(e) => {
          if (draggingRef.current) handlePointer(e);
        }}
        onPointerUp={(e) => {
          draggingRef.current = false;
          (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
        }}
        role="application"
        aria-label="Free-form placement surface"
        data-testid="freeform-surface"
        className="relative w-full rounded-md cursor-crosshair touch-none select-none"
        style={{
          aspectRatio: `${aspect}`,
          background: "var(--canvas-frame)",
          backgroundImage:
            snap !== "off"
              ? `linear-gradient(to right, color-mix(in srgb, var(--text-faint) 12%, transparent) 1px, transparent 1px),
                 linear-gradient(to bottom, color-mix(in srgb, var(--text-faint) 12%, transparent) 1px, transparent 1px)`
              : undefined,
          backgroundSize:
            snap === "12" ? `${100 / 12}% ${100 / 12}%` :
            snap === "8"  ? `${100 / 8}% ${100 / 8}%`  :
            snap === "4"  ? `${100 / 4}% ${100 / 4}%`  : undefined,
        }}
      >
        {/* Rule-of-thirds reference lines (always visible, very subtle) */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          {[1 / 3, 2 / 3].map((t) => (
            <div key={`v${t}`} className="absolute top-0 bottom-0 w-px" style={{ left: `${t * 100}%`, background: "color-mix(in srgb, var(--text-faint) 20%, transparent)" }} />
          ))}
          {[1 / 3, 2 / 3].map((t) => (
            <div key={`h${t}`} className="absolute left-0 right-0 h-px" style={{ top: `${t * 100}%`, background: "color-mix(in srgb, var(--text-faint) 20%, transparent)" }} />
          ))}
        </div>

        {/* Pin */}
        <div
          aria-hidden="true"
          data-testid="freeform-pin"
          className="absolute"
          style={{
            left: `${resolved.x * 100}%`,
            top: `${resolved.y * 100}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <div
            className="w-4 h-4 rounded-full ring-2 ring-white shadow-[var(--shadow-md)]"
            style={{ background: "var(--accent-cool)" }}
          />
          <div
            className="absolute left-1/2 top-1/2 w-px"
            style={{ height: "100vh", transform: "translate(-50%, -50%)", background: "color-mix(in srgb, var(--accent-cool) 35%, transparent)" }}
          />
          <div
            className="absolute left-1/2 top-1/2 h-px"
            style={{ width: "100vw", transform: "translate(-50%, -50%)", background: "color-mix(in srgb, var(--accent-cool) 35%, transparent)" }}
          />
        </div>

        {/* Live coords */}
        <span
          className="absolute bottom-1 right-2 text-[var(--text-fs-1)] font-mono"
          style={{ color: "var(--text-on-accent)" }}
        >
          x: {xPct}% · y: {yPct}%
        </span>
      </div>

      {/* Snap toggle */}
      <div className="flex items-center gap-2">
        <span className="text-[var(--text-fs-1)] text-[var(--text-muted)] uppercase tracking-[0.14em] font-semibold">
          Snap
        </span>
        {(["off", "12", "8", "4"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setSnap(m)}
            data-testid={`snap-${m}`}
            aria-pressed={snap === m}
            className={[
              "px-2 py-0.5 rounded-sm text-[var(--text-fs-1)] font-mono transition-colors",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]",
              snap === m
                ? "bg-[var(--accent-cool)] text-[var(--text-on-accent)]"
                : "text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]",
            ].join(" ")}
          >
            {m === "off" ? "off" : `1/${m}`}
          </button>
        ))}
      </div>

      {/* Quick anchors */}
      <div>
        <span className="block text-[var(--text-fs-1)] text-[var(--text-muted)] uppercase tracking-[0.14em] font-semibold mb-2">
          Quick anchors
        </span>
        <div className="grid grid-cols-3 gap-1.5 max-w-[8rem]">
          {ANCHORS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => handleQuickAnchor(a)}
              data-testid={`quick-anchor-${a.id}`}
              aria-pressed={value.anchor === a.id && value.x === a.x && value.y === a.y}
              className={[
                "h-9 rounded-md text-[var(--text-fs-3)] font-mono",
                "border transition-colors",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]",
                value.anchor === a.id && value.x === a.x && value.y === a.y
                  ? "bg-[var(--accent-cool)] border-[var(--accent-cool)] text-[var(--text-on-accent)]"
                  : "bg-[var(--surface-1)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--border-strong)]",
              ].join(" ")}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Numeric inputs (advanced) */}
      <details className="group">
        <summary className="text-[var(--text-fs-2)] text-[var(--text-muted)] cursor-pointer select-none hover:text-[var(--text)] transition-colors">
          Advanced — pixel margins, max size
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Margin X (px)">
            {(p) => (
              <Input
                {...p}
                type="number"
                value={value.margin_x ?? ""}
                onChange={(e) => onChange({ ...value, margin_x: e.target.value === "" ? undefined : parseInt(e.target.value, 10) })}
                placeholder="0"
                fullWidth
              />
            )}
          </Field>
          <Field label="Margin Y (px)">
            {(p) => (
              <Input
                {...p}
                type="number"
                value={value.margin_y ?? ""}
                onChange={(e) => onChange({ ...value, margin_y: e.target.value === "" ? undefined : parseInt(e.target.value, 10) })}
                placeholder="0"
                fullWidth
              />
            )}
          </Field>
          <Field label="Max width (px)">
            {(p) => (
              <Input
                {...p}
                type="number"
                value={value.max_width ?? ""}
                onChange={(e) => onChange({ ...value, max_width: e.target.value === "" ? undefined : parseInt(e.target.value, 10) })}
                placeholder="auto"
                fullWidth
              />
            )}
          </Field>
          <Field label="Max height (px)">
            {(p) => (
              <Input
                {...p}
                type="number"
                value={value.max_height ?? ""}
                onChange={(e) => onChange({ ...value, max_height: e.target.value === "" ? undefined : parseInt(e.target.value, 10) })}
                placeholder="auto"
                fullWidth
              />
            )}
          </Field>
        </div>
      </details>

      {/* Numeric x/y for keyboard accessibility */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="x (%)">
          {(p) => (
            <Input
              {...p}
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={resolved.x * 100}
              onChange={(e) => setXY(Number(e.target.value) / 100, resolved.y)}
              fullWidth
            />
          )}
        </Field>
        <Field label="y (%)">
          {(p) => (
            <Input
              {...p}
              type="number"
              min={0}
              max={100}
              step="0.1"
              value={resolved.y * 100}
              onChange={(e) => setXY(resolved.x, Number(e.target.value) / 100)}
              fullWidth
            />
          )}
        </Field>
      </div>
    </div>
  );
}

export const PLACEMENT_ANCHORS = ANCHORS;
