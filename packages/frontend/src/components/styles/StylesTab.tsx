"use client";

import { useState } from "react";
import type { Style } from "@verseline/shared";
import { useProjectStore } from "@/stores/project-store";
import { StyleList } from "./StyleList";
import { StyleEditor } from "./StyleEditor";

export function StylesTab() {
  const { project, upsertStyle, removeStyle } = useProjectStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);

  const styles = project?.styles ?? [];
  const fonts = project?.fonts ?? [];
  const selected = styles.find((s) => s.id === selectedId) ?? null;

  const handleNew = () => {
    setSelectedId(null);
    setIsNew(true);
  };

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setIsNew(false);
  };

  const handleSave = (style: Style) => {
    upsertStyle(style);
    setSelectedId(style.id);
    setIsNew(false);
  };

  const handleDelete = (id: string) => {
    removeStyle(id);
    setSelectedId(null);
    setIsNew(false);
  };

  const handleCancel = () => {
    setIsNew(false);
    if (!selected) setSelectedId(null);
  };

  return (
    <div className="flex h-full">
      {/* Left: list */}
      <div className="w-56 shrink-0 border-r border-zinc-200 dark:border-zinc-800 flex flex-col">
        <StyleList
          styles={styles}
          selectedId={selectedId}
          onSelect={handleSelect}
          onNew={handleNew}
        />
      </div>

      {/* Right: editor */}
      <div className="flex-1 min-w-0">
        <StyleEditor
          style={isNew ? null : selected}
          isNew={isNew}
          fonts={fonts}
          onSave={handleSave}
          onDelete={handleDelete}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}
