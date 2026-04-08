"use client";

import { useRef, useCallback } from "react";
import { millisToTs } from "@verseline/shared";

interface PlaybackControlsProps {
  playing: boolean;
  currentTimeMs: number;
  durationMs: number;
  playbackRate: number;
  onPlayPause: () => void;
  onSeek: (ms: number) => void;
  onRateChange: (rate: number) => void;
}

const RATE_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

/** Converts millisToTs output (HH:MM:SS.mmm) to a shorter MM:SS.mmm display. */
function formatShort(ms: number): string {
  const ts = millisToTs(Math.round(ms)); // "HH:MM:SS.mmm"
  // Drop leading "00:" (hours) if zero
  return ts.startsWith("00:") ? ts.slice(3) : ts; // "MM:SS.mmm"
}

export default function PlaybackControls({
  playing,
  currentTimeMs,
  durationMs,
  playbackRate,
  onPlayPause,
  onSeek,
  onRateChange,
}: PlaybackControlsProps) {
  const scrubRef = useRef<HTMLDivElement>(null);

  const handleScrubClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!scrubRef.current || durationMs <= 0) return;
      const rect = scrubRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, x / rect.width));
      onSeek(Math.round(pct * durationMs));
    },
    [durationMs, onSeek],
  );

  const filledPct = durationMs > 0 ? (currentTimeMs / durationMs) * 100 : 0;

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-300 dark:border-zinc-700">
      {/* Play / Pause */}
      <button
        onClick={onPlayPause}
        aria-label={playing ? "Pause" : "Play"}
        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors shrink-0"
      >
        {playing ? (
          /* Pause: two vertical bars */
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="currentColor"
            className="text-zinc-700 dark:text-zinc-300"
          >
            <rect x="2" y="1" width="4" height="12" rx="1" />
            <rect x="8" y="1" width="4" height="12" rx="1" />
          </svg>
        ) : (
          /* Play: right-facing triangle */
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="currentColor"
            className="text-zinc-700 dark:text-zinc-300"
          >
            <path d="M3 1.5l9 5.5-9 5.5V1.5z" />
          </svg>
        )}
      </button>

      {/* Time display */}
      <span className="text-xs font-mono text-zinc-600 dark:text-zinc-400 shrink-0 tabular-nums">
        {formatShort(currentTimeMs)} / {formatShort(durationMs)}
      </span>

      {/* Scrub bar */}
      <div
        ref={scrubRef}
        onClick={handleScrubClick}
        className="flex-1 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full cursor-pointer relative"
      >
        <div
          style={{ width: `${filledPct}%` }}
          className="absolute left-0 top-0 bottom-0 bg-indigo-500 rounded-full pointer-events-none"
        />
      </div>

      {/* Playback rate */}
      <select
        value={playbackRate}
        onChange={(e) => onRateChange(parseFloat(e.target.value))}
        className="text-xs bg-transparent text-zinc-600 dark:text-zinc-400 focus:outline-none cursor-pointer shrink-0"
        aria-label="Playback rate"
      >
        {RATE_OPTIONS.map((r) => (
          <option key={r} value={r}>
            {r}x
          </option>
        ))}
      </select>
    </div>
  );
}
