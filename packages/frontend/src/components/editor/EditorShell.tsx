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

  // ---- Keyboard shortcuts ----
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT";

    // Ctrl+S / Cmd+S — save (always, even in inputs)
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      handleSaveRef.current();
      return;
    }

    // Ctrl+D — duplicate segment
    if ((e.ctrlKey || e.metaKey) && e.key === "d") {
      e.preventDefault();
      handleDuplicate();
      return;
    }

    // Skip remaining shortcuts when focused on text inputs
    if (isInput) return;

    // Space — play/pause
    if (e.key === " ") {
      e.preventDefault();
      handlePlayPause();
      return;
    }

    // Delete — delete selected segment
    if (e.key === "Delete" && effectiveSelected?.id) {
      e.preventDefault();
      if (confirm("Delete this segment?")) {
        useTimelineStore.getState().deleteSegment(effectiveSelected.id);
        setSelectedId(null);
      }
      return;
    }

    // Arrow keys — seek
    const seekAmount = e.shiftKey ? 5000 : 1000;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      seek(Math.min(currentTimeMs + seekAmount, durationMs));
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      seek(Math.max(currentTimeMs - seekAmount, 0));
    }
  }, [handlePlayPause, handleDuplicate, effectiveSelected, seek, currentTimeMs, durationMs]);

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
      <div className="flex items-center justify-center h-64 text-zinc-600 dark:text-zinc-500 text-sm">
        Loading project…
      </div>
    );
  }
  if (!project) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-600 dark:text-zinc-500 text-sm">
        Project not found.
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="flex flex-col h-[calc(100vh-3.5rem)] bg-white dark:bg-zinc-950 overflow-hidden outline-none"
    >
      {/* ---- Top toolbar ---- */}
      <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 shrink-0 px-2 gap-1">
        <a
          href="/projects"
          className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 px-2 py-2.5 transition-colors"
          title="Back to projects"
        >
          &larr;
        </a>
        <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 px-2 py-3 truncate max-w-48" title={project.name}>
          {project.name ?? "Untitled"}
        </span>

        <div className="flex-1" />

        {/* Config tab pills */}
        <div className="flex gap-1">
          {CONFIG_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setRightPanel(rightPanel === tab.id ? "editor" : tab.id)}
              className={[
                "px-3 py-2.5 text-xs font-medium transition-colors relative",
                rightPanel === tab.id
                  ? "text-zinc-900 dark:text-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-indigo-500"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="w-2" />

        {/* Save button */}
        {isSaving ? (
          <span className="text-xs text-zinc-500 dark:text-zinc-400 px-2">Saving…</span>
        ) : isDirty ? (
          <button
            onClick={handleSave}
            className="text-xs text-amber-400 hover:text-amber-300 transition-colors px-2"
          >
            Save
          </button>
        ) : (
          <span className="text-xs text-zinc-400 dark:text-zinc-600 px-2">Saved</span>
        )}
      </div>

      {/* ---- Main area ---- */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left sidebar: segment list */}
        <div className="w-56 shrink-0 border-r border-zinc-300 dark:border-zinc-700 flex flex-col overflow-hidden bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">Segments</span>
            <button
              onClick={() => {
                const last = segments[segments.length - 1];
                useTimelineStore.getState().createSegment(projectId, {
                  start: last?.end ?? "00:00:00.000",
                  end: last?.end ?? "00:00:03.000",
                  blocks: [{ text: "", style: styles[0]?.id, placement: placements[0]?.id }],
                });
              }}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              + New
            </button>
          </div>
          <div className="overflow-y-auto flex-1">
            {segments.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-zinc-600 dark:text-zinc-500 text-xs">
                No segments yet
              </div>
            ) : (
              segments.map((seg, i) => {
                const isActive = seg.id === (effectiveSelected?.id);
                const preview = seg.blocks.map((b) => b.text).filter(Boolean).join(" / ");
                return (
                  <button
                    key={seg.id ?? i}
                    onClick={() => handleSelectSegment(seg.id ?? "")}
                    className={[
                      "w-full text-left px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/70 transition-colors",
                      isActive ? "bg-zinc-100 dark:bg-zinc-800" : "",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-600 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                      <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400">
                        {formatRange(seg.start, seg.end)}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-500 truncate mt-0.5">{preview || "(empty)"}</div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Center: canvas + playback + timeline */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {/* Canvas preview */}
          <div className="flex-1 min-h-0 flex items-center justify-center p-4 bg-zinc-950">
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

          {/* Playback controls */}
          <PlaybackControls
            playing={playing}
            currentTimeMs={currentTimeMs}
            durationMs={durationMs}
            playbackRate={playbackRate}
            onPlayPause={handlePlayPause}
            onSeek={handleSeek}
            onRateChange={setRate}
          />

          {/* Timeline bar */}
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
        <div className="w-80 shrink-0 border-l border-zinc-300 dark:border-zinc-700 flex flex-col overflow-hidden">
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
            <div className="flex items-center justify-center flex-1 text-zinc-600 dark:text-zinc-500 text-sm">
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

      {/* Hidden audio element */}
      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="auto" />}

      {/* ---- Status bar ---- */}
      <div className="h-7 bg-zinc-50 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex items-center px-4 gap-4 shrink-0">
        <span className="text-xs text-zinc-600 dark:text-zinc-500">
          {canvas.width}&times;{canvas.height} &middot; {canvas.fps} fps
        </span>
        <span className="text-xs text-zinc-500 dark:text-zinc-600">
          {segments.length} segment{segments.length !== 1 ? "s" : ""}
        </span>
        <div className="flex-1" />
        {saveError && <span className="text-xs text-red-600 dark:text-red-400">{saveError}</span>}
        {isSaving ? (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Saving…</span>
        ) : isDirty ? (
          <button onClick={handleSave} className="text-xs text-amber-400 hover:text-amber-300 transition-colors">
            Unsaved changes — Ctrl+S
          </button>
        ) : (
          <span className="text-xs text-zinc-400 dark:text-zinc-600">All changes saved</span>
        )}
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
      <div className="px-3 py-2 border-t border-zinc-200 dark:border-zinc-800 flex gap-2">
        <button
          onClick={() => setShowBrowser(!showBrowser)}
          className="flex-1 text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
        >
          {showBrowser ? "Close Browser" : "Browse Google Fonts"}
        </button>
        {selectedId && !showBrowser && (
          <button
            onClick={() => { removeFont(selectedId); setSelectedId(null); }}
            className="text-xs px-2 py-1.5 bg-zinc-700 hover:bg-red-900 text-white rounded-lg transition-colors"
            title="Remove font"
          >
            Remove
          </button>
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
    <div className="p-4 overflow-y-auto h-full">
      <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-4">Project Settings</h2>

      <div className="flex flex-col gap-5">
        <Section title="General">
          <Field label="Name" value={project.name ?? ""} onChange={(v) => onUpdateField("name", v || undefined)} />
        </Section>

        <Section title="Canvas">
          <div className="flex gap-3 flex-wrap">
            <FieldNum label="Width"  value={project.canvas.width}  onChange={(v) => onUpdateField("canvas.width", v)} />
            <FieldNum label="Height" value={project.canvas.height} onChange={(v) => onUpdateField("canvas.height", v)} />
            <FieldNum label="FPS"    value={project.canvas.fps}    onChange={(v) => onUpdateField("canvas.fps", v)} />
          </div>
        </Section>

        <Section title="Background">
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => setBgMode("upload")}
              className={`text-xs px-2 py-1 rounded ${bgMode === "upload" ? "bg-indigo-600 text-white" : "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"}`}
            >
              Upload
            </button>
            <button
              onClick={() => setBgMode("url")}
              className={`text-xs px-2 py-1 rounded ${bgMode === "url" ? "bg-indigo-600 text-white" : "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"}`}
            >
              URL
            </button>
          </div>
          {bgMode === "upload" ? (
            <AssetUploader
              label="Background image/video"
              fieldPath="assets.background.path"
              currentValue={bg?.path}
              accept="image/*,video/*"
              assetType="background"
            />
          ) : (
            <Field
              label="Background URL"
              value={bg?.path ?? ""}
              onChange={(v) => onUpdateField("assets.background.path", v)}
              placeholder="https://example.com/bg.jpg"
            />
          )}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500 dark:text-zinc-400">Fit</label>
            <select
              value={bg?.fit ?? "cover"}
              onChange={(e) => onUpdateField("assets.background.fit", e.target.value)}
              className="bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-400 dark:border-zinc-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {["cover", "contain"].map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </Section>

        <Section title="Audio">
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => setAudioMode("upload")}
              className={`text-xs px-2 py-1 rounded ${audioMode === "upload" ? "bg-indigo-600 text-white" : "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"}`}
            >
              Upload
            </button>
            <button
              onClick={() => setAudioMode("url")}
              className={`text-xs px-2 py-1 rounded ${audioMode === "url" ? "bg-indigo-600 text-white" : "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300"}`}
            >
              URL
            </button>
          </div>
          {audioMode === "upload" ? (
            <AssetUploader
              label="Audio file"
              fieldPath="assets.audio"
              currentValue={project.assets?.audio ?? ""}
              accept="audio/*"
              assetType="audio"
            />
          ) : (
            <Field
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

// ---- Shared mini-components -------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">{title}</h3>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-zinc-500 dark:text-zinc-400">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-400 dark:border-zinc-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
    </div>
  );
}

function FieldNum({ label, value, onChange }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-zinc-500 dark:text-zinc-400">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-400 dark:border-zinc-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 w-20"
      />
    </div>
  );
}
