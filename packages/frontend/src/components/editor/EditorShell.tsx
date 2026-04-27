"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { tsToMillis } from "@verseline/shared";
import type { Project, Font, Segment } from "@verseline/shared";
import { generateStyleLabel, generatePlacementLabel } from "@verseline/shared";

import { useProjectStore } from "@/stores/project-store";
import { useTimelineStore } from "@/stores/timeline-store";
import { usePlaybackStore } from "@/stores/playback-store";
import { useAssetUrl } from "@/hooks/useAssetUrl";

import CanvasPreview from "./CanvasPreview";
import PlaybackControls from "./PlaybackControls";
import TimelineBar from "./TimelineBar";
import SegmentEditor from "./SegmentEditor";
import { StylesTab } from "@/components/styles/StylesTab";
import { PlacementsTab } from "@/components/placements/PlacementsTab";
import { FontList } from "@/components/fonts/FontList";
import { FontBrowser } from "@/components/fonts/FontBrowser";
import { AssetUploader } from "@/components/project/AssetUploader";
import { Button, Tabs, Spinner, StatusPill } from "@/components/ui";
import { matchAction } from "@/lib/shortcuts";
import { useSettingsStore } from "@/stores/settings-store";

// ---- Types ------------------------------------------------------------------

type RightPanel = "editor" | "styles" | "placements" | "fonts" | "settings";

const CONFIG_TABS: { id: RightPanel; label: string }[] = [
  { id: "styles",     label: "Styles" },
  { id: "placements", label: "Placements" },
  { id: "fonts",      label: "Fonts" },
  { id: "settings",   label: "Settings" },
];

interface EditorShellProps {
  projectId: string;
}

// ---- Component --------------------------------------------------------------

export default function EditorShell({ projectId }: EditorShellProps) {
  // ---- Stores ----
  const {
    project,
    loading: projectLoading,
    dirty: projectDirty,
    loadProject,
    saveProject,
    updateField,
    removeFont,
  } = useProjectStore();

  const {
    segments,
    loading: timelineLoading,
    dirty: timelineDirty,
    loadSegments,
  } = useTimelineStore();

  const {
    playing,
    currentTimeMs,
    durationMs,
    playbackRate,
    play,
    pause,
    seek,
    setRate,
    setDuration,
  } = usePlaybackStore();

  // ---- Local state ----
  const [rightPanel, setRightPanel] = useState<RightPanel>("editor");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // ---- Refs ----
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const handleSaveRef = useRef<() => void>(() => {});

  // ---- Data loading (ref-guard pattern, no useEffect) ----
  const loadedRef = useRef(false);
  if (!loadedRef.current) {
    loadedRef.current = true;
    loadProject(projectId);
    loadSegments(projectId);
  }

  // ---- Derived state ----
  const styles = project?.styles ?? [];
  const placements = project?.placements ?? [];
  const fonts: Font[] = project?.fonts ?? [];
  const canvas = project?.canvas ?? { width: 1920, height: 1080, fps: 30 };

  const selected = segments.find((s) => s.id === selectedId) ?? null;
  const effectiveSelected = selected ?? segments[0] ?? null;

  const computedDuration = useMemo(() => {
    if (segments.length === 0) return 0;
    return Math.max(...segments.map((s) => tsToMillis(s.end)));
  }, [segments]);

  // Sync duration to playback store when it changes
  const prevDurationRef = useRef(0);
  if (computedDuration !== prevDurationRef.current) {
    prevDurationRef.current = computedDuration;
    setDuration(computedDuration);
  }

  // ---- Asset URLs ----
  const bgPath = project?.assets?.background?.path;
  const bgType = (project?.assets?.background?.type ?? "image") as "image" | "video";
  const backgroundUrl = useAssetUrl(project?.id, bgPath);

  const audioPath = project?.assets?.audio;
  const audioStr = typeof audioPath === "string" ? audioPath : undefined;
  const audioUrl = useAssetUrl(project?.id, audioStr);

  // ---- Handlers ----
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await saveProject();
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSaving(false);
    }
  }, [saveProject]);
  handleSaveRef.current = handleSave;

  const handlePlayPause = useCallback(() => {
    if (playing) {
      pause();
    } else {
      play(audioRef.current, videoRef.current);
    }
  }, [playing, play, pause]);

  const handleSeek = useCallback((ms: number) => {
    seek(ms);
  }, [seek]);

  const handleSelectSegment = useCallback((id: string) => {
    setSelectedId(id);
    setRightPanel("editor");
    // Seek to segment start
    const seg = segments.find((s) => s.id === id);
    if (seg) seek(tsToMillis(seg.start));
  }, [segments, seek]);

  const handleDuplicate = useCallback(async () => {
    if (!effectiveSelected?.id) return;
    const { createSegment } = useTimelineStore.getState();
    try {
      await createSegment(projectId, {
        start: effectiveSelected.start,
        end: effectiveSelected.end,
        blocks: effectiveSelected.blocks,
      });
    } catch {
      // silent
    }
  }, [effectiveSelected, projectId]);

  // ---- Keyboard shortcuts (configurable via Settings) ----
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const isInput =
      target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";

    const bindings = useSettingsStore.getState().bindings;
    const action = matchAction(e, bindings);
    if (!action) return;

    // Save and duplicate run even inside inputs.
    const allowedInInputs = action === "save" || action === "duplicateSegment";
    if (isInput && !allowedInInputs) return;

    switch (action) {
      case "save":
        e.preventDefault();
        handleSaveRef.current();
        return;
      case "duplicateSegment":
        e.preventDefault();
        handleDuplicate();
        return;
      case "playPause":
        e.preventDefault();
        handlePlayPause();
        return;
      case "deleteSegment":
        if (effectiveSelected?.id) {
          e.preventDefault();
          useTimelineStore.getState().deleteSegment(effectiveSelected.id);
          setSelectedId(null);
        }
        return;
      case "seekForward1s":
        e.preventDefault();
        seek(Math.min(currentTimeMs + 1000, durationMs));
        return;
      case "seekBack1s":
        e.preventDefault();
        seek(Math.max(currentTimeMs - 1000, 0));
        return;
      case "seekForward5s":
        e.preventDefault();
        seek(Math.min(currentTimeMs + 5000, durationMs));
        return;
      case "seekBack5s":
        e.preventDefault();
        seek(Math.max(currentTimeMs - 5000, 0));
        return;
      case "nextSegment": {
        e.preventDefault();
        const idx = segments.findIndex((s) => s.id === effectiveSelected?.id);
        const next = segments[idx + 1] ?? segments[0];
        if (next?.id) handleSelectSegment(next.id);
        return;
      }
      case "prevSegment": {
        e.preventDefault();
        const idx = segments.findIndex((s) => s.id === effectiveSelected?.id);
        const prev = segments[idx - 1] ?? segments[segments.length - 1];
        if (prev?.id) handleSelectSegment(prev.id);
        return;
      }
      case "toggleStylesPanel":
        e.preventDefault();
        setRightPanel(rightPanel === "styles" ? "editor" : "styles");
        return;
      case "togglePlacementsPanel":
        e.preventDefault();
        setRightPanel(rightPanel === "placements" ? "editor" : "placements");
        return;
      case "toggleFontsPanel":
        e.preventDefault();
        setRightPanel(rightPanel === "fonts" ? "editor" : "fonts");
        return;
      case "toggleSettingsPanel":
        e.preventDefault();
        setRightPanel(rightPanel === "settings" ? "editor" : "settings");
        return;
      default:
        return;
    }
  }, [
    handlePlayPause,
    handleDuplicate,
    effectiveSelected,
    seek,
    currentTimeMs,
    durationMs,
    segments,
    handleSelectSegment,
    rightPanel,
  ]);

  // ---- Root ref: auto-focus on mount, reset playback on unmount ----
  const rootRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      node.focus();
    } else {
      // Component unmounting — stop playback and clean up
      usePlaybackStore.getState().reset();
    }
  }, []);

  // ---- Loading / error states ----
  const isDirty = projectDirty || timelineDirty;
  const isLoading = projectLoading || timelineLoading;

  if (isLoading && !project) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-[var(--text-fs-2)] text-[var(--text-muted)]">
        <Spinner size={14} /> Loading project
      </div>
    );
  }
  if (!project) {
    return (
      <div className="flex items-center justify-center h-64 text-[var(--text-fs-2)] text-[var(--text-muted)]">
        Project not found.
      </div>
    );
  }

  const status: "saved" | "dirty" | "saving" | "error" = saveError
    ? "error"
    : isSaving
      ? "saving"
      : isDirty
        ? "dirty"
        : "saved";

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="flex flex-col h-[calc(100vh-3rem)] bg-[var(--bg)] overflow-hidden outline-none"
      data-testid="editor-root"
    >
      {/* ---- Top toolbar ---- */}
      <div
        role="toolbar"
        className="flex items-center h-11 border-b border-[var(--border)] bg-[var(--surface-1)] shrink-0 px-3 gap-3"
      >
        <a
          href="/projects"
          className="text-[var(--text-fs-2)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors px-2 py-1 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
          title="Back to projects"
          aria-label="Back to projects"
        >
          ←
        </a>
        <h1
          className="text-[var(--text-fs-3)] font-semibold text-[var(--text)] truncate max-w-[20rem]"
          title={project.name}
        >
          {project.name ?? "Untitled"}
        </h1>

        <div className="w-px h-5 bg-[var(--border)]" />

        <Tabs
          variant="underline"
          tabs={CONFIG_TABS}
          active={rightPanel}
          onChange={(id) => setRightPanel(rightPanel === id ? "editor" : id)}
        />

        <div className="flex-1" />
        {/* Save state lives in the status bar — no duplicate here */}
      </div>

      {/* ---- Main area ---- */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left sidebar: segment list */}
        <div className="w-60 shrink-0 border-r border-[var(--border)] flex flex-col overflow-hidden bg-[var(--surface-1)]">
          <div className="px-3 py-2 border-b border-[var(--border)] flex items-center justify-between">
            <span className="text-[var(--text-fs-1)] font-semibold text-[var(--text-muted)] uppercase tracking-[0.14em]">
              Segments
            </span>
            <Button
              size="sm"
              variant="ghost"
              data-testid="add-segment"
              onClick={() => {
                const last = segments[segments.length - 1];
                useTimelineStore.getState().createSegment(projectId, {
                  start: last?.end ?? "00:00:00.000",
                  end: last?.end ?? "00:00:03.000",
                  blocks: [{ text: "", style: styles[0]?.id, placement: placements[0]?.id }],
                });
              }}
            >
              + New
            </Button>
          </div>
          <div className="overflow-y-auto flex-1" role="listbox" aria-label="Segments">
            {segments.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-[var(--text-fs-1)] text-[var(--text-muted)] px-4 text-center">
                No segments yet. Press “+ New” to add one.
              </div>
            ) : (
              segments.map((seg, i) => {
                const isActive = seg.id === effectiveSelected?.id;
                const preview = seg.blocks.map((b) => b.text).filter(Boolean).join(" / ");
                return (
                  <button
                    key={seg.id ?? i}
                    role="option"
                    aria-selected={isActive}
                    data-testid={`segment-row-${i}`}
                    onClick={() => handleSelectSegment(seg.id ?? "")}
                    className={[
                      "w-full text-left px-3 py-2 transition-colors relative",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--focus-ring)]",
                      isActive
                        ? "bg-[color-mix(in_srgb,var(--accent-cool)_10%,transparent)]"
                        : "hover:bg-[var(--surface-2)]",
                    ].join(" ")}
                  >
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-1 bottom-1 w-0.5"
                        style={{ background: "var(--accent-cool)" }}
                      />
                    )}
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--text-fs-1)] font-mono text-[var(--text-faint)] shrink-0">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="text-[var(--text-fs-1)] font-mono text-[var(--text-muted)]">
                        {formatRange(seg.start, seg.end)}
                      </span>
                    </div>
                    <div className="text-[var(--text-fs-2)] text-[var(--text)] truncate mt-1">
                      {preview || (
                        <span className="text-[var(--text-faint)] italic">(empty)</span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Center: canvas + playback + timeline */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div
            className="flex-1 min-h-0 flex items-center justify-center p-4"
            style={{ background: "var(--canvas-frame)" }}
          >
            <CanvasPreview
              blocks={effectiveSelected?.blocks ?? []}
              styles={styles}
              placements={placements}
              canvas={canvas}
              backgroundUrl={backgroundUrl ?? undefined}
              backgroundType={bgType}
              videoRef={videoRef}
              currentTimeMs={currentTimeMs}
              allSegments={segments}
            />
          </div>

          <PlaybackControls
            playing={playing}
            currentTimeMs={currentTimeMs}
            durationMs={durationMs}
            playbackRate={playbackRate}
            onPlayPause={handlePlayPause}
            onSeek={handleSeek}
            onRateChange={setRate}
          />

          <TimelineBar
            segments={segments}
            currentTimeMs={currentTimeMs}
            durationMs={durationMs}
            selectedId={effectiveSelected?.id ?? null}
            onSelectSegment={handleSelectSegment}
            onSeek={handleSeek}
          />
        </div>

        {/* Right panel */}
        <div className="w-80 shrink-0 border-l border-[var(--border)] flex flex-col overflow-hidden bg-[var(--surface-1)]">
          {rightPanel === "editor" && effectiveSelected ? (
            <SegmentEditor
              key={effectiveSelected.id}
              projectId={projectId}
              segment={effectiveSelected}
              segments={segments}
              styles={styles}
              placements={placements}
              fonts={fonts}
              canvas={canvas}
            />
          ) : rightPanel === "editor" ? (
            <div className="flex items-center justify-center flex-1 text-[var(--text-fs-2)] text-[var(--text-muted)]">
              No segment selected
            </div>
          ) : rightPanel === "styles" ? (
            <StylesTab />
          ) : rightPanel === "placements" ? (
            <PlacementsTab />
          ) : rightPanel === "fonts" ? (
            <FontsTab fonts={fonts} removeFont={removeFont} />
          ) : rightPanel === "settings" ? (
            <SettingsPanel project={project} projectId={projectId} onUpdateField={updateField} />
          ) : null}
        </div>
      </div>

      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="auto" />}

      {/* ---- Status bar (single source of truth for save state) ---- */}
      <div className="h-8 bg-[var(--surface-1)] border-t border-[var(--border)] flex items-center px-4 gap-4 shrink-0">
        <span className="text-[var(--text-fs-1)] text-[var(--text-muted)] font-mono">
          {canvas.width}×{canvas.height} · {canvas.fps} fps
        </span>
        <span className="text-[var(--text-fs-1)] text-[var(--text-muted)]">
          {segments.length} segment{segments.length !== 1 ? "s" : ""}
        </span>
        <div className="flex-1" />
        {saveError && (
          <span role="alert" className="text-[var(--text-fs-1)] text-[var(--error)]" data-testid="save-error">
            ⚠ {saveError}
          </span>
        )}
        <StatusPill
          status={status}
          onClick={status === "dirty" || status === "error" ? handleSave : undefined}
          shortcut={status === "dirty" ? "⌘S" : undefined}
          label={
            status === "saving"
              ? "Saving"
              : status === "dirty"
                ? "Unsaved"
                : status === "error"
                  ? "Save failed — retry"
                  : "All changes saved"
          }
        />
      </div>
    </div>
  );
}

// ---- Helper functions -------------------------------------------------------

function formatRange(start: string, end: string) {
  function shorten(ts: string) {
    return ts.replace(/^00:/, "");
  }
  return `${shorten(start)} – ${shorten(end)}`;
}

// ---- FontsTab (wraps FontList + FontBrowser) --------------------------------

function FontsTab({ fonts, removeFont }: { fonts: Font[]; removeFont: (id: string) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showBrowser, setShowBrowser] = useState(false);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-hidden">
        {showBrowser ? (
          <FontBrowser onClose={() => setShowBrowser(false)} />
        ) : (
          <FontList fonts={fonts} selectedId={selectedId} onSelect={setSelectedId} />
        )}
      </div>
      <div className="px-3 py-2 border-t border-[var(--border)] flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          fullWidth
          onClick={() => setShowBrowser(!showBrowser)}
        >
          {showBrowser ? "Close Browser" : "Browse Google Fonts"}
        </Button>
        {selectedId && !showBrowser && (
          <Button
            size="sm"
            variant="danger"
            onClick={() => { removeFont(selectedId); setSelectedId(null); }}
            title="Remove font"
          >
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}

// ---- Settings panel ---------------------------------------------------------

function SettingsPanel({ project, projectId, onUpdateField }: {
  project: Project & { id: string };
  projectId: string;
  onUpdateField: (path: string, value: unknown) => void;
}) {
  const bg = project.assets?.background;
  const [bgMode, setBgMode] = useState<"upload" | "url">(
    bg?.path?.startsWith("projects/") ? "upload" : "url"
  );
  const [audioMode, setAudioMode] = useState<"upload" | "url">(
    (project.assets?.audio ?? "").startsWith("projects/") ? "upload" : "url"
  );

  return (
    <div className="p-4 overflow-y-auto h-full" data-testid="settings-panel">
      <h2 className="text-[var(--text-fs-3)] font-semibold text-[var(--text)] mb-4">
        Project Settings
      </h2>

      <div className="flex flex-col gap-5">
        <Section title="General">
          <SettingsField
            label="Name"
            value={project.name ?? ""}
            onChange={(v) => onUpdateField("name", v || undefined)}
          />
        </Section>

        <Section title="Canvas">
          <div className="flex gap-3 flex-wrap">
            <SettingsFieldNum
              label="Width"
              value={project.canvas.width}
              onChange={(v) => onUpdateField("canvas.width", v)}
            />
            <SettingsFieldNum
              label="Height"
              value={project.canvas.height}
              onChange={(v) => onUpdateField("canvas.height", v)}
            />
            <SettingsFieldNum
              label="FPS"
              value={project.canvas.fps}
              onChange={(v) => onUpdateField("canvas.fps", v)}
            />
          </div>
        </Section>

        <Section title="Background">
          <ModeToggle value={bgMode} onChange={setBgMode} />
          {bgMode === "upload" ? (
            <AssetUploader
              label="Background image/video"
              fieldPath="assets.background.path"
              currentValue={bg?.path}
              accept="image/*,video/*"
              assetType="background"
            />
          ) : (
            <SettingsField
              label="Background URL"
              value={bg?.path ?? ""}
              onChange={(v) => onUpdateField("assets.background.path", v)}
              placeholder="https://example.com/bg.jpg"
            />
          )}
          <div className="flex flex-col gap-1">
            <label className="text-[var(--text-fs-2)] text-[var(--text-muted)] font-medium">
              Fit
            </label>
            <select
              value={bg?.fit ?? "cover"}
              onChange={(e) => onUpdateField("assets.background.fit", e.target.value)}
              className="bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] rounded-md px-3 py-1.5 text-[var(--text-fs-3)] focus:outline-none focus:border-[var(--brand-primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
            >
              {["cover", "contain"].map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
        </Section>

        <Section title="Audio">
          <ModeToggle value={audioMode} onChange={setAudioMode} />
          {audioMode === "upload" ? (
            <AssetUploader
              label="Audio file"
              fieldPath="assets.audio"
              currentValue={project.assets?.audio ?? ""}
              accept="audio/*"
              assetType="audio"
            />
          ) : (
            <SettingsField
              label="Audio URL"
              value={project.assets?.audio ?? ""}
              onChange={(v) => onUpdateField("assets.audio", v || undefined)}
              placeholder="https://example.com/audio.mp3"
            />
          )}
        </Section>
      </div>
    </div>
  );
}

// ---- Shared mini-components for SettingsPanel ----

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[var(--text-fs-1)] font-semibold text-[var(--text-muted)] uppercase tracking-[0.14em] mb-2">
        {title}
      </h3>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function ModeToggle({
  value,
  onChange,
}: {
  value: "upload" | "url";
  onChange: (v: "upload" | "url") => void;
}) {
  return (
    <div className="flex gap-1 mb-1" role="radiogroup">
      {(["upload", "url"] as const).map((mode) => {
        const active = value === mode;
        return (
          <button
            key={mode}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(mode)}
            className={[
              "text-[var(--text-fs-1)] px-2.5 py-1 rounded-sm transition-colors",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]",
              active
                ? "bg-[var(--accent-cool)] text-[var(--text-on-accent)]"
                : "bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text)]",
            ].join(" ")}
          >
            {mode === "upload" ? "Upload" : "URL"}
          </button>
        );
      })}
    </div>
  );
}

function SettingsField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[var(--text-fs-2)] text-[var(--text-muted)] font-medium">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] rounded-md px-3 py-1.5 text-[var(--text-fs-3)] focus:outline-none focus:border-[var(--brand-primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] placeholder:text-[var(--text-faint)] transition-colors duration-[120ms] ease-[var(--ease-out-soft)]"
      />
    </div>
  );
}

function SettingsFieldNum({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[var(--text-fs-2)] text-[var(--text-muted)] font-medium">
        {label}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] rounded-md px-3 py-1.5 text-[var(--text-fs-3)] w-24 focus:outline-none focus:border-[var(--brand-primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] transition-colors duration-[120ms] ease-[var(--ease-out-soft)]"
      />
    </div>
  );
}
