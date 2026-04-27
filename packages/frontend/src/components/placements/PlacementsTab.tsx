"use client";

import { useState } from "react";
import type { Placement } from "@verseline/shared";
import { useProjectStore } from "@/stores/project-store";
import { PlacementList } from "./PlacementList";
import { PlacementEditor } from "./PlacementEditor";
import { PresetPicker } from "@/components/library/PresetPicker";
import { Button, toast } from "@/components/ui";

export function PlacementsTab() {
  const { project, upsertPlacement, removePlacement } = useProjectStore();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const placements = project?.placements ?? [];
  const canvas = project?.canvas ?? { width: 1920, height: 1080, fps: 30 };
  const selected = placements.find((p) => p.id === selectedId) ?? null;

  const handleNew = () => {
    setSelectedId(null);
    setIsNew(true);
  };

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setIsNew(false);
  };

  const handleSave = (placement: Placement) => {
    upsertPlacement(placement);
    setSelectedId(placement.id);
    setIsNew(false);
  };

  const handleDelete = (id: string) => {
    removePlacement(id);
    setSelectedId(null);
    setIsNew(false);
  };

  const handleCancel = () => {
    setIsNew(false);
    if (!selected) setSelectedId(null);
  };

  const handlePick = (preset: Placement | unknown) => {
    const p = preset as Placement;
    upsertPlacement(p);
    setSelectedId(p.id);
    setIsNew(false);
    toast.success(`“${p.name || p.id}” inserted`);
  };

  return (
    <div className="flex h-full" data-testid="placements-tab">
      <div className="w-56 shrink-0 border-r border-[var(--border)] flex flex-col">
        <div className="px-3 py-2 border-b border-[var(--border)] flex items-center justify-between">
          <span className="text-[var(--text-fs-1)] font-semibold text-[var(--text-muted)] uppercase tracking-[0.14em]">
            Placements
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowPicker(true)}
            data-testid="open-placement-picker"
            title="Insert from library"
          >
            Library
          </Button>
        </div>
        <PlacementList
          placements={placements}
          selectedId={selectedId}
          onSelect={handleSelect}
          onNew={handleNew}
        />
      </div>
      <div className="flex-1 min-w-0">
        <PlacementEditor
          key={isNew ? "__new__" : (selectedId ?? "__none__")}
          placement={isNew ? null : selected}
          isNew={isNew}
          canvas={canvas}
          onSave={handleSave}
          onDelete={handleDelete}
          onCancel={handleCancel}
        />
      </div>

      <PresetPicker
        kind="placement"
        open={showPicker}
        onClose={() => setShowPicker(false)}
        onPick={handlePick}
      />
    </div>
  );
}
