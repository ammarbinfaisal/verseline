"use client";

import { useParams } from "next/navigation";
import EditorShell from "@/components/editor/EditorShell";

export default function ProjectEditorPage() {
  const { id } = useParams<{ id: string }>();
  return <EditorShell projectId={id} />;
}
