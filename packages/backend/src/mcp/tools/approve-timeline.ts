import { z } from "zod";
import { approveTimeline } from "../api-client.js";

export const approveTimelineInputSchema = {
  project_id: z.string().min(1).describe("The project UUID whose draft timeline should be copied to approved"),
};

export async function handleApproveTimeline(input: { project_id: string }) {
  const approved = await approveTimeline(input.project_id);

  const output = {
    project_id: input.project_id,
    approved_segment_count: approved.length,
  };

  const text = `Approved timeline for project ${input.project_id}: ${approved.length} segment${approved.length === 1 ? "" : "s"} copied`;

  return {
    content: [
      { type: "text" as const, text },
      { type: "text" as const, text: JSON.stringify(output, null, 2) },
    ],
  };
}
