CREATE TABLE IF NOT EXISTS "decision_memory_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"stage_source" integer NOT NULL,
	"entry_type" text NOT NULL,
	"content" text NOT NULL,
	"field_path" text,
	"evidence_level" text DEFAULT 'ai_inferred',
	"confirmed_at" timestamp DEFAULT now() NOT NULL,
	"previous_version_id" text,
	"modified_by" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "knowledge_document" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"source_type" text DEFAULT 'general' NOT NULL,
	"stage_relevance" integer,
	"metadata" jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"embedding" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT '',
	"user_id" text,
	"context" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stage_record" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"stage_number" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"consultation_messages" jsonb DEFAULT '[]'::jsonb,
	"structured_output" jsonb,
	"audit_result" jsonb,
	"search_context" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "decision_memory_entry" ADD CONSTRAINT "decision_memory_entry_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stage_record" ADD CONSTRAINT "stage_record_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "project_stage_idx" ON "stage_record" USING btree ("project_id","stage_number");