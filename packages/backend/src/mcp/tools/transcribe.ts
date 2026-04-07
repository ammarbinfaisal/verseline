import { z } from "zod";
import { createReadStream } from "fs";
import { mkdir, writeFile, stat } from "fs/promises";
import { resolve, basename, join, isAbsolute } from "path";
import { createWriteStream } from "fs";

export const transcribeInputSchema = {
  audio_path: z
    .string()
    .min(1)
    .describe(
      "Absolute or relative path to the audio file (mp3, wav, m4a, ogg, etc.)",
    ),
  output_dir: z
    .string()
    .min(1)
    .describe(
      "Directory where JSONL batch files will be written. Created if it does not exist.",
    ),
  lines_per_batch: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(50)
    .describe(
      "Number of transcript lines per JSONL file (1–100, default 50).",
    ),
  language: z
    .string()
    .optional()
    .describe(
      'ISO-639-1 language code hint (e.g. "en", "ar"). Leave blank to auto-detect.',
    ),
  model: z
    .string()
    .optional()
    .default("whisper-1")
    .describe('Whisper model to use (default: "whisper-1")'),
};

interface WhisperSegment {
  start: number;
  end: number;
  text: string;
  avg_logprob?: number;
  no_speech_prob?: number;
}

interface WhisperResponse {
  language?: string;
  duration?: number;
  segments?: WhisperSegment[];
}

function msToTs(ms: number): string {
  const totalMs = Math.round(ms);
  const h = Math.floor(totalMs / 3_600_000);
  const m = Math.floor((totalMs % 3_600_000) / 60_000);
  const s = Math.floor((totalMs % 60_000) / 1_000);
  const millis = totalMs % 1_000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

function secondsToTs(sec: number): string {
  return msToTs(Math.round(sec * 1000));
}

function whisperConfidence(seg: WhisperSegment): number {
  if (seg.avg_logprob !== undefined && seg.no_speech_prob !== undefined) {
    const logprobScore = Math.exp(Math.max(seg.avg_logprob, -10));
    return Math.max(0, Math.min(1, logprobScore * (1 - seg.no_speech_prob)));
  }
  return 1.0;
}

export async function handleTranscribe(input: {
  audio_path: string;
  output_dir: string;
  lines_per_batch?: number;
  language?: string;
  model?: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not set (export it or add it to .env next to the server)",
    );
  }

  // Resolve audio path
  let audioPath = input.audio_path.trim();
  if (!isAbsolute(audioPath)) {
    audioPath = resolve(process.cwd(), audioPath);
  }
  try {
    await stat(audioPath);
  } catch {
    throw new Error(`Audio file not found: ${audioPath}`);
  }

  // Resolve output dir
  let outputDir = input.output_dir.trim();
  if (!isAbsolute(outputDir)) {
    outputDir = resolve(process.cwd(), outputDir);
  }
  await mkdir(outputDir, { recursive: true });

  const linesPerBatch = Math.min(Math.max(input.lines_per_batch ?? 50, 1), 100);
  const model = input.model?.trim() || "whisper-1";

  // Call Whisper API using multipart/form-data
  const formData = new FormData();

  // Read file as Blob
  const fileBytes = await import("fs/promises").then((fs) => fs.readFile(audioPath));
  const audioBlob = new Blob([fileBytes]);
  const audioName = basename(audioPath);
  formData.append("file", audioBlob, audioName);
  formData.append("model", model);
  formData.append("response_format", "verbose_json");
  formData.append("timestamp_granularities[]", "segment");
  if (input.language?.trim()) {
    formData.append("language", input.language.trim());
  }

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!res.ok) {
    let msg = `Whisper API error: HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body.error?.message) msg = `Whisper API error: ${body.error.message}`;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }

  const whisper = (await res.json()) as WhisperResponse;
  const rawSegs = whisper.segments ?? [];

  interface TranscriptLine {
    start: string;
    end: string;
    text: string;
    confidence: number;
  }

  const lines: TranscriptLine[] = rawSegs
    .map((seg) => ({
      start: secondsToTs(seg.start),
      end: secondsToTs(seg.end),
      text: seg.text.trim(),
      confidence: whisperConfidence(seg),
    }))
    .filter((l) => l.text !== "");

  // Write batch files
  interface BatchFile {
    path: string;
    line_count: number;
  }
  const batchFiles: BatchFile[] = [];

  for (let i = 0; i < lines.length; i += linesPerBatch) {
    const batch = lines.slice(i, i + linesPerBatch);
    const batchNum = batchFiles.length + 1;
    const fileName = `batch-${String(batchNum).padStart(3, "0")}.jsonl`;
    const filePath = join(outputDir, fileName);
    const content = batch.map((l) => JSON.stringify(l)).join("\n") + "\n";
    await writeFile(filePath, content, "utf8");
    batchFiles.push({ path: filePath, line_count: batch.length });
  }

  const output = {
    audio_path: audioPath,
    language: whisper.language ?? "",
    duration: whisper.duration ?? 0,
    total_lines: lines.length,
    batch_files: batchFiles,
  };

  const text =
    `Transcribed ${basename(audioPath)}: ${lines.length} lines in ${batchFiles.length} batch file(s)` +
    (whisper.duration ? `, ${whisper.duration.toFixed(1)}s` : "") +
    (whisper.language ? `, language=${whisper.language}` : "");

  return {
    content: [
      { type: "text" as const, text },
      { type: "text" as const, text: JSON.stringify(output, null, 2) },
    ],
  };
}
