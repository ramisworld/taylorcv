ALTER TABLE "job_requirements"
  ADD COLUMN IF NOT EXISTS "query_embedding" vector(1536),
  ADD COLUMN IF NOT EXISTS "query_embedding_model" TEXT,
  ADD COLUMN IF NOT EXISTS "query_embedding_input_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "query_embedded_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "job_requirements_query_embedding_model_query_embedding_input_hash_idx"
  ON "job_requirements"("query_embedding_model", "query_embedding_input_hash");
