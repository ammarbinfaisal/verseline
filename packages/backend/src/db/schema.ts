import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
  integer,
  real,
  text,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ---- users ----

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ---- password reset tokens ----

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ---- projects ----

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  name: varchar("name", { length: 255 }).notNull(),
  canvas: jsonb("canvas").notNull(),
  assets: jsonb("assets").notNull(),
  fonts: jsonb("fonts").notNull().default(sql`'[]'::jsonb`),
  styles: jsonb("styles").notNull().default(sql`'[]'::jsonb`),
  placements: jsonb("placements").notNull().default(sql`'[]'::jsonb`),
  sources: jsonb("sources").default(sql`'[]'::jsonb`),
  overlays: jsonb("overlays").default(sql`'[]'::jsonb`),
  renderProfiles: jsonb("render_profiles").notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ---- segments ----

export const segments = pgTable(
  "segments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    timelineKind: varchar("timeline_kind", { length: 20 })
      .notNull()
      .default("draft"),
    sortOrder: integer("sort_order").notNull(),
    startMs: integer("start_ms").notNull(),
    endMs: integer("end_ms").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("draft"),
    confidence: real("confidence"),
    notes: text("notes"),
    blocks: jsonb("blocks").notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [
    index("idx_segments_project_kind").on(t.projectId, t.timelineKind),
    index("idx_segments_project_kind_order").on(
      t.projectId,
      t.timelineKind,
      t.sortOrder,
    ),
  ],
);

// ---- library assets ----

export const libraryAssets = pgTable(
  "library_assets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    name: varchar("name", { length: 255 }).notNull(),
    assetType: varchar("asset_type", { length: 50 }).notNull(),
    r2Key: varchar("r2_key", { length: 500 }),
    filename: varchar("filename", { length: 255 }).notNull(),
    contentType: varchar("content_type", { length: 100 }),
    metadata: jsonb("metadata").default(sql`'{}'::jsonb`),
    pexelsId: varchar("pexels_id", { length: 50 }),
    pexelsUrl: varchar("pexels_url", { length: 500 }),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [
    index("idx_library_assets_user").on(t.userId),
    index("idx_library_assets_user_type").on(t.userId, t.assetType),
    index("idx_library_assets_pexels").on(t.pexelsId),
  ],
);

// ---- library asset <-> project join ----

export const libraryAssetProjects = pgTable(
  "library_asset_projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    libraryAssetId: uuid("library_asset_id")
      .notNull()
      .references(() => libraryAssets.id),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id),
    linkedAt: timestamp("linked_at").defaultNow(),
  },
  (t) => [
    index("idx_lap_library_asset").on(t.libraryAssetId),
    index("idx_lap_project").on(t.projectId),
    uniqueIndex("idx_lap_unique").on(t.libraryAssetId, t.projectId),
  ],
);

// ---- saved searches ----

export const savedSearches = pgTable(
  "saved_searches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    query: varchar("query", { length: 255 }).notNull(),
    searchType: varchar("search_type", { length: 20 }).notNull().default("photo"),
    resultCount: integer("result_count"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [index("idx_saved_searches_user").on(t.userId)],
);

// ---- presets (shared library tier) ----
//
// User-saved or built-in reusable Style / Placement / Font definitions. The
// payload column holds the validated shared schema object (StyleSchema,
// PlacementSchema, or FontSchema). Built-in rows have userId = NULL and
// builtIn = true; users cannot delete or modify them.

export const presets = pgTable(
  "presets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // null for built-in / global presets
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 20 }).notNull(), // "style" | "placement" | "font"
    payload: jsonb("payload").notNull(),
    builtIn: boolean("built_in").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [
    index("idx_presets_user_kind").on(t.userId, t.kind),
    index("idx_presets_builtin_kind").on(t.builtIn, t.kind),
    // Prevent the same payload-id from being saved twice for the same user+kind.
    // Built-in presets all share userId=NULL so this also dedupes them.
    uniqueIndex("idx_presets_user_kind_payload_id").on(
      t.userId,
      t.kind,
      sql`(payload->>'id')`,
    ),
  ],
);

// ---- renderJobs ----

export const renderJobs = pgTable("render_jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => projects.id),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  profileId: varchar("profile_id", { length: 100 }),
  progress: real("progress").default(0),
  outputKey: varchar("output_key", { length: 500 }),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
