"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Project } from "@verseline/shared";

interface ProjectRecord {
  id: string;
  data: Project;
  created_at: string;
  updated_at: string;
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showLegacy, setShowLegacy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const legacyProjectRef = useRef<HTMLInputElement>(null);
  const legacyTimelineRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.projects
      .list()
      .then(setProjects)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleNewProject() {
    setCreating(true);
    try {
      const record = await api.projects.create({
        name: "Untitled project",
        canvas: { width: 1920, height: 1080, fps: 30 },
        assets: { background: { path: "" } },
        timeline: {},
      });
      router.push(`/projects/${record.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
      setCreating(false);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setError(null);
    try {
      const result = await api.importExport.importFile(file);
      router.push(`/projects/${(result as any).project?.id ?? (result as any).id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setImporting(false);
    }
  }

  async function handleLegacyImport() {
    const projectFile = legacyProjectRef.current?.files?.[0];
    if (!projectFile) { setError("Select a project.json file"); return; }
    const timelineFile = legacyTimelineRef.current?.files?.[0] ?? undefined;
    setImporting(true);
    setError(null);
    try {
      const result = await api.importExport.importFile(projectFile, "legacy", timelineFile);
      router.push(`/projects/${(result as any).project?.id ?? (result as any).id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setImporting(false);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-white">Projects</h1>
        <div className="flex items-center gap-3">
          <input ref={fileRef} type="file" accept=".verseline,.verseline.json,.json" className="hidden" onChange={handleImport} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="px-4 py-2 rounded-lg bg-zinc-800 text-white font-medium text-sm hover:bg-zinc-700 transition-colors border border-zinc-700 disabled:opacity-50"
          >
            {importing ? "Importing..." : "Import"}
          </button>
          <button
            onClick={handleNewProject}
            disabled={creating}
            className="px-4 py-2 rounded-lg bg-white text-zinc-950 font-medium text-sm hover:bg-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? "Creating..." : "New project"}
          </button>
        </div>
      </div>

      {/* Legacy import toggle */}
      <div className="mb-6">
        <button
          onClick={() => setShowLegacy(!showLegacy)}
          className="text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
        >
          {showLegacy ? "Hide" : "Import legacy format"}
        </button>
        {showLegacy && (
          <div className="mt-3 p-4 bg-zinc-900 border border-zinc-800 rounded-lg space-y-3">
            <p className="text-xs text-zinc-400">Import a project.json + timeline.jsonl from the old format.</p>
            <div className="flex items-center gap-3">
              <label className="text-xs text-zinc-500">
                project.json
                <input ref={legacyProjectRef} type="file" accept=".json" className="ml-2 text-xs text-zinc-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-zinc-800 file:text-zinc-300" />
              </label>
              <label className="text-xs text-zinc-500">
                timeline.jsonl
                <input ref={legacyTimelineRef} type="file" accept=".jsonl,.json" className="ml-2 text-xs text-zinc-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-zinc-800 file:text-zinc-300" />
              </label>
              <button
                onClick={handleLegacyImport}
                disabled={importing}
                className="px-3 py-1.5 rounded bg-zinc-800 text-white text-xs hover:bg-zinc-700 border border-zinc-700 disabled:opacity-50"
              >
                Import
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-4 py-3 mb-6">
          {error}
        </p>
      )}

      {loading ? (
        <div className="text-zinc-500 text-sm">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-zinc-500 text-sm mb-4">No projects yet.</p>
          <button
            onClick={handleNewProject}
            disabled={creating}
            className="px-4 py-2 rounded-lg bg-zinc-800 text-white font-medium text-sm hover:bg-zinc-700 transition-colors border border-zinc-700 disabled:opacity-50"
          >
            Create your first project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="group block bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-600 transition-colors"
            >
              <h2 className="font-medium text-white text-sm truncate group-hover:text-zinc-100 mb-2">
                {p.data.name ?? "Untitled project"}
              </h2>
              <p className="text-xs text-zinc-500">
                {p.data.canvas.width} &times; {p.data.canvas.height} &middot;{" "}
                {p.data.canvas.fps} fps
              </p>
              <p className="text-xs text-zinc-600 mt-3">
                {new Date(p.updated_at).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
