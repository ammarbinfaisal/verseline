import { getProjects } from "../api-client.js";

export const listProjectsInputSchema = {};

export async function handleListProjects(_input: Record<string, never>) {
  const projects = await getProjects();

  const items = projects.map((p) => ({
    id: p.id,
    name: p.name,
    canvas: p.canvas,
    created_at: p.createdAt,
  }));

  const output = { projects: items };
  const text = `Listed ${items.length} project${items.length === 1 ? "" : "s"}`;

  return {
    content: [
      { type: "text" as const, text },
      { type: "text" as const, text: JSON.stringify(output, null, 2) },
    ],
  };
}
