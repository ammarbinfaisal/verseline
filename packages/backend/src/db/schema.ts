import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
  integer,
  real,
  text,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ---- users ----

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
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
