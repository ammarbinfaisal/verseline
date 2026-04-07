"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, type ProjectRecord } from "@/lib/api";

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Projects</h1>
        <div className="flex items-center gap-3">
          <input ref={fileRef} type="file" accept=".verseline" className="hidden" onChange={handleImport} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium text-sm hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors border border-zinc-300 dark:border-zinc-700 disabled:opacity-50"
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

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-4 py-3 mb-6">
          {error}
        </p>
      )}

      {loading ? (
        <div className="text-zinc-600 dark:text-zinc-500 text-sm">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-zinc-600 dark:text-zinc-500 text-sm mb-4">No projects yet.</p>
          <button
            onClick={handleNewProject}
            disabled={creating}
            className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium text-sm hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors border border-zinc-300 dark:border-zinc-700 disabled:opacity-50"
          >
            Create your first project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(Array.isArray(projects) ? projects : []).map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="group block bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors"
            >
              <h2 className="font-medium text-zinc-900 dark:text-white text-sm truncate group-hover:text-zinc-800 dark:group-hover:text-zinc-100 mb-2">
                {p.name ?? "Untitled project"}
              </h2>
              <p className="text-xs text-zinc-600 dark:text-zinc-500">
                {p.canvas?.width} &times; {p.canvas?.height} &middot;{" "}
                {p.canvas?.fps} fps
              </p>
              <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-3">
                {new Date(p.updatedAt ?? p.createdAt).toLocaleDateString(undefined, {
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
