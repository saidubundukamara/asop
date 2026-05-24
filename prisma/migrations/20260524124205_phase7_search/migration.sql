-- Phase 7 — Postgres full-text search (FR-SEARCH-1).
--
-- Each searchable table gets a STORED generated tsvector column. STORED means
-- Postgres maintains the index automatically on every INSERT/UPDATE, so we
-- never have to touch a write site or run a trigger. Access from app code
-- goes through $queryRaw helpers in src/lib/server/db/search.ts — the column
-- is declared as Unsupported("tsvector") in schema.prisma so it doesn't
-- appear on the typed Prisma client.
--
-- Task description is sanitized HTML, so we strip tags before tokenizing.
-- User name/email use the 'simple' config to avoid stemming ("Jamie" → "jami").
-- Title-like columns get weight 'A', body-like columns 'B', for ts_rank_cd.

-- --- task: title (A) + description (B, HTML-stripped) ---
ALTER TABLE "task" ADD COLUMN "search_tsv" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(regexp_replace("description", '<[^>]+>', ' ', 'g'), '')), 'B')
  ) STORED;

CREATE INDEX "task_search_tsv_idx" ON "task" USING GIN ("search_tsv");

-- --- task_comment: body ---
ALTER TABLE "task_comment" ADD COLUMN "search_tsv" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce("body", ''))) STORED;

CREATE INDEX "task_comment_search_tsv_idx" ON "task_comment" USING GIN ("search_tsv");

-- --- report_field_value: valueText (other column types aren't searchable) ---
ALTER TABLE "report_field_value" ADD COLUMN "search_tsv" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce("valueText", ''))) STORED;

CREATE INDEX "report_field_value_search_tsv_idx" ON "report_field_value" USING GIN ("search_tsv");

-- --- report_comment: body ---
ALTER TABLE "report_comment" ADD COLUMN "search_tsv" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce("body", ''))) STORED;

CREATE INDEX "report_comment_search_tsv_idx" ON "report_comment" USING GIN ("search_tsv");

-- --- user: name (A) + email (B). 'simple' avoids stemming. ---
ALTER TABLE "user" ADD COLUMN "search_tsv" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce("name", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce("email", '')), 'B')
  ) STORED;

CREATE INDEX "user_search_tsv_idx" ON "user" USING GIN ("search_tsv");
