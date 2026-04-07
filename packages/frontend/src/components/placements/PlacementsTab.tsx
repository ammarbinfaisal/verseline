"use client";

import { useState } from "react";
import type { Placement } from "@verseline/shared";
import { useProjectStore } from "@/stores/project-store";
import { PlacementList } from "./PlacementList";
import { PlacementEditor } from "./PlacementEditor";

export function PlacementsTab() {
  const { project, upsertPlacement, removePlacement } = useProjectStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);

  const placements = project?.placements ?? [];
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

  return (
    <div className="flex h-full">
      <div className="w-56 shrink-0 border-r border-zinc-200 dark:border-zinc-800 flex flex-col">
        <PlacementList
          placements={placements}
          selectedId={selectedId}
          onSelect={handleSelect}
          onNew={handleNew}
        />
      </div>
      <div className="flex-1 min-w-0">
        <PlacementEditor
          placement={isNew ? null : selected}
          isNew={isNew}
          onSave={handleSave}
          onDelete={handleDelete}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}
