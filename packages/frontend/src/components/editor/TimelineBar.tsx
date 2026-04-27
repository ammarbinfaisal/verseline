"use client";

import { useRef, useMemo, useCallback } from "react";
import { tsToMillis } from "@verseline/shared";

interface TimelineBarProps {
  segments: Array<{ id?: string; start: string; end: string; blocks: Array<{ text?: string }> }>;
  currentTimeMs: number;
  durationMs: number;
  selectedId: string | null;
  onSelectSegment: (id: string) => void;
  onSeek: (ms: number) => void;
}

const TICK_INTERVAL_S = 10;

export default function TimelineBar({
  segments,
  currentTimeMs,
  durationMs,
  selectedId,
  onSelectSegment,
  onSeek,
}: TimelineBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const ticks = useMemo(() => {
    if (durationMs <= 0) return [];
    const totalS = Math.floor(durationMs / 1000);
    const result: Array<{ label: string; pct: number }> = [];
    // Skip every other tick on dense timelines so labels never overlap
    const stride = totalS > 600 ? TICK_INTERVAL_S * 6 : totalS > 120 ? TICK_INTERVAL_S * 2 : TICK_INTERVAL_S;
    for (let s = 0; s <= totalS; s += stride) {
      const mm = Math.floor(s / 60);
      const ss = s % 60;
      result.push({
        label: `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`,
        pct: (s * 1000) / durationMs,
      });
    }
    return result;
  }, [durationMs]);

  const handleContainerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target !== containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, x / rect.width));
      onSeek(Math.round(pct * durationMs));
    },
    [durationMs, onSeek],
  );

  if (durationMs <= 0) {
    return (
      <div
        className="relative h-16 border-t border-[var(--border)] flex items-center justify-center"
        style={{ background: "var(--timeline-bg)" }}
      >
        <span className="text-[var(--text-fs-1)] text-[var(--text-faint)]">
          No segments — add one to begin
        </span>
      </div>
    );
  }

  const playheadPct = (currentTimeMs / durationMs) * 100;

  return (
    <div
      ref={containerRef}
      className="relative h-16 border-t border-[var(--border)] overflow-hidden cursor-crosshair"
      style={{ background: "var(--timeline-bg)" }}
      onClick={handleContainerClick}
      data-testid="timeline-bar"
    >
      {segments.map((seg, i) => {
        const startMs = tsToMillis(seg.start);
        const endMs = tsToMillis(seg.end);
        const leftPct = (startMs / durationMs) * 100;
        const widthPct = ((endMs - startMs) / durationMs) * 100;
        const isSelected = seg.id != null && seg.id === selectedId;
        const firstText = seg.blocks[0]?.text ?? "";

        return (
          <button
            key={seg.id ?? i}
            data-testid={`timeline-segment-${i}`}
            data-selected={isSelected || undefined}
            style={{
              left: `${leftPct}%`,
              width: `${widthPct}%`,
              background: isSelected ? "var(--segment-selected)" : "var(--segment-default)",
            }}
            className="absolute top-2 bottom-2 rounded-sm overflow-hidden px-1.5 text-left transition-colors hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
            onClick={(e) => {
              e.stopPropagation();
              if (seg.id) onSelectSegment(seg.id);
            }}
          >
            <span
              className="block text-[var(--text-fs-1)] leading-tight truncate pointer-events-none"
              style={{ color: isSelected ? "var(--text-on-accent)" : "var(--text)" }}
            >
              {firstText}
            </span>
          </button>
        );
      })}

      {/* Time ruler */}
      {ticks.map(({ label, pct }) => (
        <div
          key={label}
          style={{ left: `${pct * 100}%` }}
          className="absolute bottom-0 flex flex-col items-start pointer-events-none"
        >
          <div className="w-px h-1.5" style={{ background: "var(--border-strong)" }} />
          <span
            className="text-[var(--text-fs-1)] font-mono leading-none ml-0.5"
            style={{ color: "var(--text-faint)" }}
          >
            {label}
          </span>
        </div>
      ))}

      {/* Playhead */}
      <div
        style={{ left: `${playheadPct}%`, background: "var(--playhead)" }}
        className="absolute top-0 bottom-0 w-0.5 z-10 pointer-events-none"
      />
    </div>
  );
}
