"use client";

import { useState } from "react";
import type { Style } from "@verseline/shared";
import { useProjectStore } from "@/stores/project-store";
import { StyleList } from "./StyleList";
import { StyleEditor } from "./StyleEditor";
import { PresetPicker } from "@/components/library/PresetPicker";
import { Button, toast } from "@/components/ui";

export function StylesTab() {
  const { project, upsertStyle, removeStyle } = useProjectStore();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

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

  const handlePick = (preset: Style | unknown) => {
    const s = preset as Style;
    upsertStyle(s);
    setSelectedId(s.id);
    setIsNew(false);
    toast.success(`“${s.id}” inserted`);
  };

  return (
    <div className="flex h-full" data-testid="styles-tab">
      <div className="w-56 shrink-0 border-r border-[var(--border)] flex flex-col">
        <div className="px-3 py-2 border-b border-[var(--border)] flex items-center justify-between">
          <span className="text-[var(--text-fs-1)] font-semibold text-[var(--text-muted)] uppercase tracking-[0.14em]">
            Styles
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowPicker(true)}
            data-testid="open-style-picker"
            title="Insert from library"
          >
            Library
          </Button>
        </div>
        <StyleList
          styles={styles}
          selectedId={selectedId}
          onSelect={handleSelect}
          onNew={handleNew}
        />
      </div>

      <div className="flex-1 min-w-0">
        <StyleEditor
          key={isNew ? "__new__" : (selectedId ?? "__none__")}
          style={isNew ? null : selected}
          isNew={isNew}
          fonts={fonts}
          onSave={handleSave}
          onDelete={handleDelete}
          onCancel={handleCancel}
        />
      </div>

      <PresetPicker
        kind="style"
        open={showPicker}
        onClose={() => setShowPicker(false)}
        onPick={handlePick}
      />
    </div>
  );
}
