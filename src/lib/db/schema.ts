import { pgTable, text, timestamp, integer, jsonb, uniqueIndex } from "drizzle-orm/pg-core";

// ── Project ──────────────────────────────────────────────
export const project = pgTable("project", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").default(""),
  userId: text("user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── StageRecord ──────────────────────────────────────────
export const stageRecord = pgTable(
  "stage_record",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id),
    stageNumber: integer("stage_number").notNull(),
    status: text("status").notNull().default("draft"), // draft|active|waiting_confirm|completed|failed|blocked|archived
    consultationMessages: jsonb("consultation_messages").default([]),
    structuredOutput: jsonb("structured_output"),
    auditResult: jsonb("audit_result"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    projectStageIdx: uniqueIndex("project_stage_idx").on(
      table.projectId,
      table.stageNumber
    ),
  })
);

// ── DecisionMemoryEntry ──────────────────────────────────
export const decisionMemoryEntry = pgTable("decision_memory_entry", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => project.id),
  stageSource: integer("stage_source").notNull(),
  entryType: text("entry_type").notNull(), // confirmed_fact | confirmed_decision | hypothesis | unresolved_question
  content: text("content").notNull(),
  fieldPath: text("field_path"), // e.g. "founderMotivation.content"
  evidenceLevel: text("evidence_level").default("ai_inferred"), // search_backed | search_snippet | ai_inferred
  confirmedAt: timestamp("confirmed_at").defaultNow().notNull(),
});
