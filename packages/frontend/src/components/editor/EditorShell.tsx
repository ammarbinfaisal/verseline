"use client";

import { useEffect, useState, useCallback } from "react";
import { useProjectStore } from "@/stores/project-store";
import { useTimelineStore } from "@/stores/timeline-store";
import TimelinePanel from "./TimelinePanel";
import { StylesTab } from "@/components/styles/StylesTab";
import { PlacementsTab } from "@/components/placements/PlacementsTab";
import { FontList } from "@/components/fonts/FontList";
import { FontBrowser } from "@/components/fonts/FontBrowser";
import type { Project } from "@verseline/shared";

type Tab = "timeline" | "styles" | "placements" | "fonts" | "settings";

const TABS: { id: Tab; label: string }[] = [
  { id: "timeline",   label: "Timeline"   },
  { id: "styles",     label: "Styles"     },
  { id: "placements", label: "Placements" },
  { id: "fonts",      label: "Fonts"      },
  { id: "settings",   label: "Settings"   },
];

interface EditorShellProps {
  projectId: string;
}

export default function EditorShell({ projectId }: EditorShellProps) {
  const {
    project,
    loading: projectLoading,
    dirty: projectDirty,
    loadProject,
    saveProject,
    updateField,
  } = useProjectStore();

  const {
    loading: timelineLoading,
    dirty: timelineDirty,
    loadSegments,
  } = useTimelineStore();

  const [activeTab, setActiveTab] = useState<Tab>("timeline");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadProject(projectId);
    loadSegments(projectId, "draft");
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Ctrl+S / Cmd+S keyboard shortcut
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave]);

  const isDirty = projectDirty || timelineDirty;
  const isLoading = projectLoading || timelineLoading;

  if (isLoading && !project) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">
        Loading project…
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">
        Project not found.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-zinc-950 overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center border-b border-zinc-800 bg-zinc-900 shrink-0 px-2">
        <span className="text-sm font-medium text-zinc-200 px-3 py-3 mr-2 truncate max-w-48" title={project.name}>
          {project.name ?? "Untitled"}
        </span>
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                "px-3 py-2.5 text-xs font-medium transition-colors relative",
                activeTab === tab.id
                  ? "text-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-indigo-500"
                  : "text-zinc-400 hover:text-zinc-200",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "timeline"   && <TimelinePanel projectId={projectId} />}
        {activeTab === "styles"     && <StylesTab />}
        {activeTab === "placements" && <PlacementsTab />}
        {activeTab === "fonts"      && <FontsTab />}
        {activeTab === "settings"   && <SettingsPanel project={project} onUpdateField={updateField} />}
      </div>

      {/* Status bar */}
      <div className="h-7 bg-zinc-900 border-t border-zinc-800 flex items-center px-4 gap-4 shrink-0">
        <span className="text-xs text-zinc-500">
          {project.canvas.width}&times;{project.canvas.height} &middot; {project.canvas.fps} fps
        </span>
        <div className="flex-1" />
        {saveError && <span className="text-xs text-red-400">{saveError}</span>}
        {isSaving ? (
          <span className="text-xs text-zinc-400">Saving…</span>
        ) : isDirty ? (
          <button
            onClick={handleSave}
            className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
          >
            Unsaved changes — Save (Ctrl+S)
          </button>
        ) : (
          <span className="text-xs text-zinc-600">All changes saved</span>
        )}
      </div>
    </div>
  );
}

// ---- Fonts tab (wraps existing FontList + FontBrowser) ----

function FontsTab() {
  const { project, removeFont } = useProjectStore();
  const fonts = project?.fonts ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showBrowser, setShowBrowser] = useState(false);

  return (
    <div className="flex h-full">
      {/* Left: project font list */}
      <div className="w-56 shrink-0 border-r border-zinc-800 flex flex-col">
        <div className="flex-1 min-h-0 overflow-hidden">
          <FontList fonts={fonts} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
        <div className="px-4 py-3 border-t border-zinc-800 flex gap-2">
          <button
            onClick={() => setShowBrowser(true)}
            className="flex-1 text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
          >
            Browse Google Fonts
          </button>
          {selectedId && (
            <button
              onClick={() => { removeFont(selectedId); setSelectedId(null); }}
              className="text-xs px-2 py-1.5 bg-zinc-700 hover:bg-red-900 text-white rounded-lg transition-colors"
              title="Remove font"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Right: detail or browser */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {showBrowser ? (
          <FontBrowser onClose={() => setShowBrowser(false)} />
        ) : selectedId ? (
          <FontDetail font={fonts.find((f) => f.id === selectedId)} />
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
            Select a font or browse Google Fonts
          </div>
        )}
      </div>
    </div>
  );
}

import type { Font } from "@verseline/shared";

function FontDetail({ font }: { font: Font | undefined }) {
  if (!font) return null;
  return (
    <div className="p-6">
      <h3 className="text-sm font-semibold text-zinc-200 mb-4">{font.id}</h3>
      <div className="flex flex-col gap-2">
        <div><span className="text-xs text-zinc-500">Family:</span> <span className="text-sm text-zinc-200 ml-2">{font.family}</span></div>
        {font.files && font.files.length > 0 && (
          <div>
            <span className="text-xs text-zinc-500">Files:</span>
            <ul className="mt-1 ml-2">
              {font.files.map((f, i) => (
                <li key={i} className="text-xs text-zinc-400 font-mono truncate">{f}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Settings panel ----

function SettingsPanel({ project, onUpdateField }: {
  project: Project & { id: string };
  onUpdateField: (path: string, value: unknown) => void;
}) {
  return (
    <div className="p-6 overflow-y-auto h-full max-w-xl">
      <h2 className="text-sm font-semibold text-zinc-200 mb-6">Project Settings</h2>

      <div className="flex flex-col gap-5">
        <Section title="General">
          <Field label="Name" value={project.name ?? ""} onChange={(v) => onUpdateField("name", v || undefined)} />
          <Field label="Output path" value={project.output ?? ""} onChange={(v) => onUpdateField("output", v || undefined)} placeholder="e.g. out/final.mp4" />
        </Section>

        <Section title="Canvas">
          <div className="flex gap-3 flex-wrap">
            <FieldNum label="Width"  value={project.canvas.width}  onChange={(v) => onUpdateField("canvas.width", v)}  />
            <FieldNum label="Height" value={project.canvas.height} onChange={(v) => onUpdateField("canvas.height", v)} />
            <FieldNum label="FPS"    value={project.canvas.fps}    onChange={(v) => onUpdateField("canvas.fps", v)}    />
          </div>
        </Section>

        <Section title="Background">
          <Field label="Path / URL" value={project.assets.background.path} onChange={(v) => onUpdateField("assets.background.path", v)} />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-400">Fit</label>
            <select
              value={project.assets.background.fit ?? "cover"}
              onChange={(e) => onUpdateField("assets.background.fit", e.target.value)}
              className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {["cover","contain","fill","none"].map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </Section>

        <Section title="Audio">
          <Field label="Audio path" value={project.assets.audio ?? ""} onChange={(v) => onUpdateField("assets.audio", v || undefined)} placeholder="path/to/audio.mp3" />
        </Section>
      </div>
    </div>
  );
}

// ---- Shared mini-components ----

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">{title}</h3>
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
      <label className="text-xs text-zinc-400">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
      <label className="text-xs text-zinc-400">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 w-24"
      />
    </div>
  );
}
