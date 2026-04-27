/**
 * Seed the built-in preset catalogue.
 *
 *   bun run src/scripts/seed-presets.ts
 *
 * Idempotent: each row is keyed by (user_id IS NULL, kind, payload->>'id'),
 * which is enforced by idx_presets_user_kind_payload_id. Re-running the
 * script updates any rows whose payload has changed and adds new ones.
 *
 * See /design.md §V2.3 — these are the v1 catalogue. Add or remove rows
 * here, run the script, you're done.
 */

import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { presets } from "../db/schema.js";
import {
  validatePresetPayload,
  type PresetKind,
} from "@verseline/shared";

interface SeedRow {
  kind: PresetKind;
  payload: Record<string, unknown>;
}

const SEED: SeedRow[] = [
  // ---- Placements ----
  {
    kind: "placement",
    payload: {
      id: "caption-bottom-third",
      name: "Caption · bottom third",
      anchor: "bottom_center",
      x: 0.5,
      y: 0.85,
    },
  },
  {
    kind: "placement",
    payload: {
      id: "lyric-center",
      name: "Lyric · center",
      anchor: "center",
      x: 0.5,
      y: 0.5,
    },
  },
  {
    kind: "placement",
    payload: {
      id: "translation-top-third",
      name: "Translation · top third",
      anchor: "top_center",
      x: 0.5,
      y: 0.15,
    },
  },
  {
    kind: "placement",
    payload: {
      id: "lower-third-left",
      name: "Lower third · left",
      anchor: "bottom_left",
      x: 0.15,
      y: 0.85,
    },
  },
  {
    kind: "placement",
    payload: {
      id: "chyron-bottom-left",
      name: "Chyron · bottom-left",
      anchor: "bottom_left",
      x: 0.1,
      y: 0.9,
    },
  },

  // ---- Styles ----
  {
    kind: "style",
    payload: {
      id: "caption-default",
      font: "geist-sans",
      size: 36,
      color: "#FFFFFF",
      outline: 4,
      outline_color: "#000000",
      align: "center",
    },
  },
  {
    kind: "style",
    payload: {
      id: "caption-emphasis",
      font: "geist-sans",
      size: 48,
      color: "#D88A3A",
      outline: 3,
      outline_color: "#1B1410",
      align: "center",
    },
  },
  {
    kind: "style",
    payload: {
      id: "translation-cool",
      font: "geist-sans",
      size: 32,
      color: "#A29CAE",
      align: "center",
      line_height: 130,
    },
  },
  {
    kind: "style",
    payload: {
      id: "lyric-display",
      font: "fraunces",
      size: 60,
      color: "#FFFFFF",
      shadow: 4,
      shadow_color: "#1B1A1F",
      align: "center",
    },
  },

  // ---- Fonts (metadata pointers — actual files load via next/font) ----
  {
    kind: "font",
    payload: { id: "geist-sans", family: "Geist Sans" },
  },
  {
    kind: "font",
    payload: { id: "fraunces", family: "Fraunces" },
  },
];

async function main() {
  console.log(`[seed-presets] ${SEED.length} rows to upsert`);
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of SEED) {
    let payload;
    try {
      payload = validatePresetPayload(row.kind, row.payload);
    } catch (err) {
      console.warn(`[seed-presets] skipping invalid ${row.kind}/${(row.payload as { id?: string }).id ?? "?"}:`, err);
      skipped++;
      continue;
    }
    const payloadId = (payload as { id: string }).id;
    const [existing] = await db
      .select()
      .from(presets)
      .where(
        and(
          isNull(presets.userId),
          eq(presets.kind, row.kind),
          sql`(payload->>'id') = ${payloadId}`,
        ),
      )
      .limit(1);

    if (existing) {
      const [u] = await db
        .update(presets)
        .set({ payload, updatedAt: new Date() })
        .where(eq(presets.id, existing.id))
        .returning();
      if (u) updated++;
    } else {
      const [i] = await db
        .insert(presets)
        .values({ userId: null, kind: row.kind, payload, builtIn: true })
        .returning();
      if (i) inserted++;
    }
  }

  console.log(`[seed-presets] inserted=${inserted} updated=${updated} skipped=${skipped}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed-presets] fatal:", err);
  process.exit(1);
});
