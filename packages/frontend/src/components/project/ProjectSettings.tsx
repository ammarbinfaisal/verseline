"use client";

import { useState } from "react";
import type { RenderProfile } from "@verseline/shared";
import { useProjectStore } from "@/stores/project-store";
import { AssetUploader } from "./AssetUploader";

// ---- Shared primitives ----

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-4">{title}</h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-zinc-400">{label}</label>
      <input
        type="text"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
      />
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-zinc-400">{label}</label>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        placeholder={placeholder ?? "0"}
        className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500 transition-colors"
      />
    </div>
  );
}

// ---- Render profile row ----

const EMPTY_PROFILE: RenderProfile = {
  id: "",
  label: "",
  width: undefined,
  height: undefined,
  fps: undefined,
  output: undefined,
  output_suffix: undefined,
  video_codec: undefined,
  audio_codec: undefined,
  audio_bitrate: undefined,
  crf: undefined,
  preset: undefined,
  pix_fmt: undefined,
  color_primaries: undefined,
  color_trc: undefined,
  colorspace: undefined,
  color_range: undefined,
  extra_args: undefined,
};

function RenderProfileRow({
  profile,
  onChange,
  onRemove,
}: {
  profile: RenderProfile;
  onChange: (updated: RenderProfile) => void;
  onRemove: () => void;
}) {
  const set = <K extends keyof RenderProfile>(key: K, value: RenderProfile[K]) =>
    onChange({ ...profile, [key]: value });

  const setNum = (key: keyof RenderProfile) => (v: number) =>
    set(key, v === 0 ? undefined : v);

  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={profile.id}
          onChange={(e) => set("id", e.target.value)}
          placeholder="profile-id"
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 font-mono focus:outline-none focus:border-blue-500"
        />
        <input
          type="text"
          value={profile.label ?? ""}
          onChange={(e) => set("label", e.target.value || undefined)}
          placeholder="Label"
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500"
        />
        <button
          onClick={onRemove}
          className="shrink-0 text-xs text-red-500 hover:text-red-400 px-2 py-1 hover:bg-zinc-700 rounded transition-colors"
        >
          Remove
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Width</label>
          <input type="number" value={profile.width ?? ""} onChange={(e) => setNum("width")(parseInt(e.target.value, 10) || 0)} placeholder="inherit" className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-blue-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Height</label>
          <input type="number" value={profile.height ?? ""} onChange={(e) => setNum("height")(parseInt(e.target.value, 10) || 0)} placeholder="inherit" className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-blue-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">FPS</label>
          <input type="number" value={profile.fps ?? ""} onChange={(e) => setNum("fps")(parseInt(e.target.value, 10) || 0)} placeholder="inherit" className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-blue-500" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Output path</label>
          <input type="text" value={profile.output ?? ""} onChange={(e) => set("output", e.target.value || undefined)} placeholder="output.mp4" className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 font-mono focus:outline-none focus:border-blue-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Output suffix</label>
          <input type="text" value={profile.output_suffix ?? ""} onChange={(e) => set("output_suffix", e.target.value || undefined)} placeholder="_4k" className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 font-mono focus:outline-none focus:border-blue-500" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Video codec</label>
          <input type="text" value={profile.video_codec ?? ""} onChange={(e) => set("video_codec", e.target.value || undefined)} placeholder="libx264" className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 font-mono focus:outline-none focus:border-blue-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Audio codec</label>
          <input type="text" value={profile.audio_codec ?? ""} onChange={(e) => set("audio_codec", e.target.value || undefined)} placeholder="aac" className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 font-mono focus:outline-none focus:border-blue-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Audio bitrate</label>
          <input type="text" value={profile.audio_bitrate ?? ""} onChange={(e) => set("audio_bitrate", e.target.value || undefined)} placeholder="192k" className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 font-mono focus:outline-none focus:border-blue-500" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">CRF</label>
          <input type="number" value={profile.crf ?? ""} onChange={(e) => setNum("crf")(parseInt(e.target.value, 10) || 0)} placeholder="23" className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-blue-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Preset</label>
          <input type="text" value={profile.preset ?? ""} onChange={(e) => set("preset", e.target.value || undefined)} placeholder="medium" className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 font-mono focus:outline-none focus:border-blue-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Pix fmt</label>
          <input type="text" value={profile.pix_fmt ?? ""} onChange={(e) => set("pix_fmt", e.target.value || undefined)} placeholder="yuv420p" className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 font-mono focus:outline-none focus:border-blue-500" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Color primaries</label>
          <input type="text" value={profile.color_primaries ?? ""} onChange={(e) => set("color_primaries", e.target.value || undefined)} placeholder="bt709" className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 font-mono focus:outline-none focus:border-blue-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Color TRC</label>
          <input type="text" value={profile.color_trc ?? ""} onChange={(e) => set("color_trc", e.target.value || undefined)} placeholder="bt709" className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 font-mono focus:outline-none focus:border-blue-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Colorspace</label>
          <input type="text" value={profile.colorspace ?? ""} onChange={(e) => set("colorspace", e.target.value || undefined)} placeholder="bt709" className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 font-mono focus:outline-none focus:border-blue-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Color range</label>
          <input type="text" value={profile.color_range ?? ""} onChange={(e) => set("color_range", e.target.value || undefined)} placeholder="tv" className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 font-mono focus:outline-none focus:border-blue-500" />
        </div>
      </div>
    </div>
  );
}

// ---- Main component ----

export function ProjectSettings() {
  const { project, updateField, saveProject, loading } = useProjectStore();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!project) return null;

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await saveProject();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const profiles = project.render_profiles ?? [];

  const setProfile = (idx: number, updated: RenderProfile) => {
    const next = profiles.map((p, i) => (i === idx ? updated : p));
    updateField("render_profiles", next);
  };

  const removeProfile = (idx: number) => {
    updateField("render_profiles", profiles.filter((_, i) => i !== idx));
  };

  const addProfile = () => {
    updateField("render_profiles", [
      ...profiles,
      { ...EMPTY_PROFILE, id: `profile-${profiles.length + 1}` },
    ]);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-6 py-4 border-b border-zinc-800 flex items-center gap-3">
        <h2 className="text-sm font-semibold text-zinc-200 flex-1">Project Settings</h2>
        {saveError && (
          <span className="text-xs text-red-400">{saveError}</span>
        )}
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      <div className="px-6 py-6 space-y-6 max-w-2xl">

        {/* General */}
        <Section title="General">
          <TextField
            label="Project name"
            value={project.name}
            onChange={(v) => updateField("name", v || undefined)}
            placeholder="My Project"
          />
          <TextField
            label="Default output path"
            value={project.output}
            onChange={(v) => updateField("output", v || undefined)}
            placeholder="output.mp4"
          />
        </Section>

        {/* Canvas */}
        <Section title="Canvas">
          <div className="grid grid-cols-3 gap-3">
            <NumberField
              label="Width (px)"
              value={project.canvas.width}
              onChange={(v) => updateField("canvas.width", v)}
              placeholder="1920"
            />
            <NumberField
              label="Height (px)"
              value={project.canvas.height}
              onChange={(v) => updateField("canvas.height", v)}
              placeholder="1080"
            />
            <NumberField
              label="FPS"
              value={project.canvas.fps}
              onChange={(v) => updateField("canvas.fps", v)}
              placeholder="30"
            />
          </div>
        </Section>

        {/* Assets */}
        <Section title="Assets">
          <AssetUploader
            label="Audio file"
            fieldPath="assets.audio"
            currentValue={project.assets.audio}
            accept="audio/*"
          />

          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Background type"
              value={project.assets.background?.type}
              onChange={(v) => updateField("assets.background.type", v || undefined)}
              placeholder="video"
            />
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-400">Background fit</label>
              <select
                value={project.assets.background?.fit ?? ""}
                onChange={(e) => updateField("assets.background.fit", e.target.value || undefined)}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500 transition-colors"
              >
                <option value="">-- none --</option>
                <option value="cover">Cover</option>
                <option value="contain">Contain</option>
                <option value="fill">Fill</option>
                <option value="none">None</option>
              </select>
            </div>
          </div>

          <AssetUploader
            label="Background file"
            fieldPath="assets.background.path"
            currentValue={project.assets.background?.path}
            accept="video/*,image/*"
          />
        </Section>

        {/* Render profiles */}
        <Section title="Render Profiles">
          {profiles.length === 0 ? (
            <p className="text-xs text-zinc-600">No render profiles yet.</p>
          ) : (
            <div className="space-y-3">
              {profiles.map((profile, idx) => (
                <RenderProfileRow
                  key={idx}
                  profile={profile}
                  onChange={(updated) => setProfile(idx, updated)}
                  onRemove={() => removeProfile(idx)}
                />
              ))}
            </div>
          )}
          <button
            onClick={addProfile}
            className="w-full py-2 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
          >
            + Add Profile
          </button>
        </Section>
      </div>
    </div>
  );
}
