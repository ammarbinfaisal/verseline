"use client";

import { useEffect, useState } from "react";
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

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-white">Projects</h1>
        <button
          onClick={handleNewProject}
          disabled={creating}
          className="px-4 py-2 rounded-lg bg-white text-zinc-950 font-medium text-sm hover:bg-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {creating ? "Creating..." : "New project"}
        </button>
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
