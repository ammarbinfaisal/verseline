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
    for (let s = 0; s <= totalS; s += TICK_INTERVAL_S) {
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
      <div className="relative h-16 bg-zinc-100 dark:bg-zinc-900 border-t border-zinc-300 dark:border-zinc-700 flex items-center justify-center">
        <span className="text-xs text-zinc-500 dark:text-zinc-600">No segments</span>
      </div>
    );
  }

  const playheadPct = (currentTimeMs / durationMs) * 100;

  return (
    <div
      ref={containerRef}
      className="relative h-16 bg-zinc-100 dark:bg-zinc-900 border-t border-zinc-300 dark:border-zinc-700 overflow-hidden cursor-crosshair"
      onClick={handleContainerClick}
    >
      {/* Segments */}
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
            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
            className={[
              "absolute top-2 bottom-2 rounded-sm overflow-hidden px-1 text-left transition-colors",
              isSelected
                ? "bg-indigo-500/80"
                : "bg-zinc-400/60 dark:bg-zinc-600/60 hover:bg-indigo-400/70",
            ].join(" ")}
            onClick={(e) => {
              e.stopPropagation();
              if (seg.id) onSelectSegment(seg.id);
            }}
          >
            <span className="block text-[10px] leading-tight text-white truncate pointer-events-none">
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
          <div className="w-px h-1.5 bg-zinc-400/60 dark:bg-zinc-600/60" />
          <span className="text-[8px] text-zinc-500 dark:text-zinc-600 leading-none ml-0.5">
            {label}
          </span>
        </div>
      ))}

      {/* Playhead */}
      <div
        style={{ left: `${playheadPct}%` }}
        className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
      />
    </div>
  );
}
