"use client";

import { useRef, useCallback } from "react";
import { millisToTs } from "@verseline/shared";
import { IconButton } from "@/components/ui";

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

function formatShort(ms: number): string {
  const ts = millisToTs(Math.round(ms));
  return ts.startsWith("00:") ? ts.slice(3) : ts;
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
    <div
      className="flex items-center gap-3 px-3 py-2 bg-[var(--surface-1)] border-t border-[var(--border)]"
      data-testid="playback-controls"
    >
      <IconButton
        size="md"
        variant={playing ? "primary" : "default"}
        label={playing ? "Pause" : "Play"}
        onClick={onPlayPause}
        data-testid="play-pause"
      >
        {playing ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <rect x="3" y="2" width="4" height="12" rx="1" />
            <rect x="9" y="2" width="4" height="12" rx="1" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M3 2l11 6-11 6V2z" />
          </svg>
        )}
      </IconButton>

      <span
        className="text-[var(--text-fs-2)] font-mono text-[var(--text-muted)] tabular-nums shrink-0"
        data-testid="time-display"
      >
        {formatShort(currentTimeMs)} / {formatShort(durationMs)}
      </span>

      <div
        ref={scrubRef}
        onClick={handleScrubClick}
        role="slider"
        aria-label="Playback position"
        aria-valuemin={0}
        aria-valuemax={durationMs}
        aria-valuenow={currentTimeMs}
        tabIndex={0}
        className="flex-1 h-2 bg-[var(--surface-2)] rounded-full cursor-pointer relative focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
      >
        <div
          style={{
            width: `${filledPct}%`,
            background: "var(--brand-primary)",
          }}
          className="absolute left-0 top-0 bottom-0 rounded-full pointer-events-none"
        />
      </div>

      <select
        value={playbackRate}
        onChange={(e) => onRateChange(parseFloat(e.target.value))}
        aria-label="Playback rate"
        className="text-[var(--text-fs-2)] bg-transparent text-[var(--text-muted)] hover:text-[var(--text)] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] cursor-pointer shrink-0 px-1 rounded-sm font-mono"
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
