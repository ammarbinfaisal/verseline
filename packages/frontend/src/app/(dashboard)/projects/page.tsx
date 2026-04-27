"use client";

import { useState, useRef } from "react";
import { useMountEffect } from "@/hooks/useMountEffect";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, type ProjectRecord } from "@/lib/api";
import { Button, EmptyState, Skeleton, toast } from "@/components/ui";

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useMountEffect(() => {
    api.projects
      .list()
      .then(setProjects)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  });

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
      const msg = err instanceof Error ? err.message : "Failed to create project";
      setError(msg);
      toast.error(msg);
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
      const id = (result as { project?: { id: string }; id?: string }).project?.id ??
        (result as { id?: string }).id;
      if (id) router.push(`/projects/${id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Import failed";
      setError(msg);
      toast.error(msg);
      setImporting(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-8 py-12">
      {/* Header — asymmetric, h1 dominant */}
      <header className="flex items-end justify-between gap-6 mb-10 pb-6 border-b border-[var(--border)]">
        <div>
          <p className="text-[var(--text-fs-1)] uppercase tracking-[0.18em] text-[var(--text-muted)] font-mono mb-2">
            Workspace
          </p>
          <h1
            className="font-display text-[var(--text-fs-7)] text-[var(--text)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Projects
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".verseline" className="hidden" onChange={handleImport} />
          <Button
            variant="ghost"
            onClick={() => fileRef.current?.click()}
            loading={importing}
            data-testid="import-project"
          >
            {importing ? "Importing" : "Import"}
          </Button>
          <Button
            variant="primary"
            onClick={handleNewProject}
            loading={creating}
            data-testid="new-project"
          >
            {creating ? "Creating" : "New project"}
          </Button>
        </div>
      </header>

      {error && (
        <p
          role="alert"
          className="text-[var(--text-fs-2)] px-4 py-3 mb-6 rounded-md"
          style={{ background: "var(--error-bg)", color: "var(--error)" }}
        >
          {error}
        </p>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" aria-label="Loading projects">
          {[0, 1, 2].map((i) => (
            <div key={i} className="p-5 rounded-[var(--radius-md)] bg-[var(--surface-1)] border border-[var(--border)]">
              <Skeleton height={16} className="mb-3 w-3/4" />
              <Skeleton height={12} className="mb-2 w-1/2" />
              <Skeleton height={10} className="w-1/3" />
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          body="Create a new project to start placing timed text on audio or video."
          cta={
            <Button
              variant="primary"
              size="lg"
              onClick={handleNewProject}
              loading={creating}
              data-testid="empty-new-project"
            >
              {creating ? "Creating" : "Create your first project"}
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(Array.isArray(projects) ? projects : []).map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              data-testid={`project-${p.id}`}
              className="group block p-5 rounded-[var(--radius-md)] bg-[var(--surface-1)] border border-[var(--border)] hover:border-[var(--border-strong)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
            >
              <h2 className="text-[var(--text-fs-3)] font-semibold text-[var(--text)] truncate mb-2">
                {p.name ?? "Untitled project"}
              </h2>
              <p className="text-[var(--text-fs-2)] text-[var(--text-muted)] font-mono">
                {p.canvas?.width} × {p.canvas?.height} · {p.canvas?.fps} fps
              </p>
              <p className="text-[var(--text-fs-1)] text-[var(--text-faint)] mt-3">
                Updated{" "}
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
