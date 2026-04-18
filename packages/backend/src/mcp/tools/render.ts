import { z } from "zod";
import { getSegments, previewSegment, renderProject, getRenderJob } from "../api-client.js";
import { findSegment } from "../helpers.js";

// ---- previewSegment ----

export const previewSegmentInputSchema = {
  project_id: z.string().min(1).describe("The project UUID"),
  segment_number: z
    .number()
    .int()
    .min(1)
    .optional()
    .default(1)
    .describe("1-based segment number from the draft timeline (default: 1)"),
};

export async function handlePreviewSegment(input: {
  project_id: string;
  segment_number?: number;
}) {
  const segmentNumber = input.segment_number ?? 1;

  // Validate segment exists and find 0-based index
  const allSegments = await getSegments(input.project_id, "draft");
  const [, idx] = findSegment(allSegments, segmentNumber, undefined);

  // segIndex is 0-based in the URL
  const result = await previewSegment(input.project_id, idx);

  const output = {
    url: result.url,
    key: result.key,
    project_id: input.project_id,
    segment_number: segmentNumber,
  };

  const text = `Preview rendered for segment ${segmentNumber}; URL valid for 1 hour`;

  return {
    content: [
      { type: "text" as const, text },
      { type: "text" as const, text: JSON.stringify(output, null, 2) },
    ],
  };
}

// ---- renderProject ----

export const renderProjectInputSchema = {
  project_id: z.string().min(1).describe("The project UUID to render"),
  profile_id: z
    .string()
    .optional()
    .default("default")
    .describe('Render profile ID to use (default: "default"). Must exist in project renderProfiles or be "default".'),
};

export async function handleRenderProject(input: {
  project_id: string;
  profile_id?: string;
}) {
  const profileId = input.profile_id ?? "default";

  const result = await renderProject(input.project_id, profileId);

  const output = {
    job_id: result.jobId,
    status: result.status,
    profile_id: profileId,
    project_id: input.project_id,
  };

  const text = `Render job ${result.jobId} started for project ${input.project_id} (profile: ${profileId})`;

  return {
    content: [
      { type: "text" as const, text },
      { type: "text" as const, text: JSON.stringify(output, null, 2) },
    ],
  };
}

// ---- getRenderJob ----

export const getRenderJobInputSchema = {
  job_id: z.string().min(1).describe("The render job UUID to poll"),
};

export async function handleGetRenderJob(input: { job_id: string }) {
  const job = await getRenderJob(input.job_id);

  const output = {
    job_id: job.id,
    project_id: job.projectId,
    status: job.status,
    profile_id: job.profileId,
    progress: job.progress,
    output_key: job.outputKey,
    download_url: job.downloadUrl ?? null,
    error: job.error,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
  };

  const text = `Render job ${job.id}: status=${job.status}, progress=${job.progress ?? 0}%${job.downloadUrl ? `, downloadUrl available` : ""}`;

  return {
    content: [
      { type: "text" as const, text },
      { type: "text" as const, text: JSON.stringify(output, null, 2) },
    ],
  };
}
