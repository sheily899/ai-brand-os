import { pgTable, text, timestamp, integer, jsonb, uniqueIndex, index } from "drizzle-orm/pg-core";

// ── Project ──────────────────────────────────────────────
export const project = pgTable("project", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").default(""),
  userId: text("user_id"),
  /** 持久化上下文（报告自定义、用户偏好等）。JSON 自由格式。 */
  context: jsonb("context"),
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
    /** 搜索上下文（advance 时写入，供后续 consultation 轮次注入 system prompt） */
    searchContext: text("search_context"),
    /** 乐观锁版本号，每次 structuredOutput 修改时 +1 */
    version: integer("version").default(1).notNull(),
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

// ── KnowledgeDocument ───────────────────────────────────
// pgvector 扩展需在 Supabase 中手动启用：
//   CREATE EXTENSION IF NOT EXISTS vector;
// 向量列使用 text 存储（JSON 序列化的浮点数组），
// 正式环境切换为 pgvector 原生 vector(384) 类型。
export const knowledgeDocument = pgTable("knowledge_document", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  sourceType: text("source_type").notNull().default("general"),
  stageRelevance: integer("stage_relevance"),
  metadata: jsonb("metadata"),
  status: text("status").notNull().default("active"), // active | archived
  embedding: jsonb("embedding"), // number[] — 正式环境替换为 pgvector vector(384)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

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
  /** 版本链：指向上一个版本的 entry id（首次创建为 null） */
  previousVersionId: text("previous_version_id"),
  /** 修改人：user（手动编辑）| ai（系统重新生成） */
  modifiedBy: text("modified_by"),
});

// ── Token Consumption ────────────────────────────────────
// 每次 LLM 调用的 Token 消耗记录。
// 在 LLM Provider 层自动记录，业务代码无需手动调用。
export const tokenConsumption = pgTable(
  "token_consumption",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id),
    stageNumber: integer("stage_number").notNull(),
    /** 调用类型：consultation | convergence | audit | reoptimize | search_intent | search_ranking | opening */
    callType: text("call_type").notNull(),
    model: text("model").notNull().default("deepseek-chat"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),
    /** 预估 prompt tokens（system prompt 部分，非精确） */
    systemPromptTokens: integer("system_prompt_tokens").default(0),
    /** 预估对话历史 tokens */
    conversationTokens: integer("conversation_tokens").default(0),
    /** Prompt Cache: 缓存创建 tokens（写入缓存） */
    cacheCreationTokens: integer("cache_creation_tokens").default(0),
    /** Prompt Cache: 缓存读取 tokens（从缓存命中） */
    cacheReadTokens: integer("cache_read_tokens").default(0),
    /** 实际计费 input tokens（扣除缓存命中） */
    billableTokens: integer("billable_tokens").default(0),
    /** 端到端延迟 (ms) */
    latencyMs: integer("latency_ms"),
    /** 实验分组: baseline | cache */
    experimentGroup: text("experiment_group"),
    /** 额外元数据（如 temperature、maxTokens 等） */
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    projectStageIdx: index("tc_project_stage_idx").on(
      table.projectId,
      table.stageNumber
    ),
    callTypeIdx: index("tc_call_type_idx").on(table.callType),
    createdAtIdx: index("tc_created_at_idx").on(table.createdAt),
  })
);

// ── Stage Field Version ──────────────────────────────────
// 阶段字段编辑的版本链，每条记录是一次修改的完整快照。
// 链式结构（previousVersionId），版本只增不删。
export const stageFieldVersion = pgTable("stage_field_version", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => project.id),
  stageNumber: integer("stage_number").notNull(),
  fieldPath: text("field_path").notNull(),
  previousValue: jsonb("previous_value"),
  newValue: jsonb("new_value").notNull(),
  modifiedBy: text("modified_by").notNull().default("user"),
  modifiedAt: timestamp("modified_at").defaultNow().notNull(),
  previousVersionId: text("previous_version_id"),
});
