ALTER TYPE "SourceType" ADD VALUE IF NOT EXISTS 'cv_upload';
ALTER TYPE "SourceType" ADD VALUE IF NOT EXISTS 'linkedin';
ALTER TYPE "SourceType" ADD VALUE IF NOT EXISTS 'background';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'weak'
      AND enumtypid = '"EvidenceConfidence"'::regtype
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'low'
      AND enumtypid = '"EvidenceConfidence"'::regtype
  ) THEN
    ALTER TYPE "EvidenceConfidence" RENAME VALUE 'weak' TO 'low';
  END IF;
END $$;

ALTER TABLE "candidate_profiles"
  DROP CONSTRAINT IF EXISTS "candidate_profiles_application_id_fkey";

DROP INDEX IF EXISTS "candidate_profiles_application_id_key";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidate_profiles' AND column_name = 'application_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidate_profiles' AND column_name = 'source_application_id'
  ) THEN
    ALTER TABLE "candidate_profiles"
      RENAME COLUMN "application_id" TO "source_application_id";
  END IF;
END $$;

ALTER TABLE "candidate_profiles"
  DROP CONSTRAINT IF EXISTS "candidate_profiles_anonymous_session_id_fkey";

ALTER TABLE "candidate_profiles"
  ALTER COLUMN "anonymous_session_id" DROP NOT NULL,
  ALTER COLUMN "source_application_id" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "user_id" TEXT,
  ADD COLUMN IF NOT EXISTS "source_type" "SourceType",
  ADD COLUMN IF NOT EXISTS "source_key" TEXT,
  ADD COLUMN IF NOT EXISTS "source_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "content_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3);

UPDATE "candidate_profiles"
SET
  "last_seen_at" = COALESCE("last_seen_at", "created_at", CURRENT_TIMESTAMP),
  "updated_at" = COALESCE("updated_at", "created_at", CURRENT_TIMESTAMP),
  "source_key" = COALESCE(
    "source_key",
    CONCAT(COALESCE("profile_source", 'profile'), ':', COALESCE("source_url", "source_application_id", "id"))
  ),
  "source_hash" = COALESCE(
    "source_hash",
    md5(CONCAT_WS(
      E'\n',
      COALESCE("raw_cv_text", ''),
      COALESCE("raw_background_text", ''),
      COALESCE("source_url", '')
    ))
  ),
  "content_hash" = COALESCE(
    "content_hash",
    md5(CONCAT_WS(
      E'\n',
      COALESCE("summary", ''),
      COALESCE("skills_json"::text, ''),
      COALESCE("projects_json"::text, ''),
      COALESCE("experience_json"::text, ''),
      COALESCE("education_json"::text, ''),
      COALESCE("certifications_json"::text, ''),
      COALESCE("tools_json"::text, ''),
      COALESCE("achievements_json"::text, '')
    ))
  );

CREATE INDEX IF NOT EXISTS "candidate_profiles_user_id_idx"
  ON "candidate_profiles"("user_id");
CREATE INDEX IF NOT EXISTS "candidate_profiles_source_application_id_idx"
  ON "candidate_profiles"("source_application_id");
CREATE INDEX IF NOT EXISTS "candidate_profiles_source_key_idx"
  ON "candidate_profiles"("source_key");
CREATE INDEX IF NOT EXISTS "candidate_profiles_content_hash_idx"
  ON "candidate_profiles"("content_hash");

CREATE UNIQUE INDEX IF NOT EXISTS "candidate_profiles_user_source_key_active_key"
  ON "candidate_profiles"("user_id", "source_key")
  WHERE "user_id" IS NOT NULL AND "source_key" IS NOT NULL AND "archived_at" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "candidate_profiles_session_source_key_active_key"
  ON "candidate_profiles"("anonymous_session_id", "source_key")
  WHERE "user_id" IS NULL AND "anonymous_session_id" IS NOT NULL AND "source_key" IS NOT NULL AND "archived_at" IS NULL;

ALTER TABLE "candidate_profiles"
  ADD CONSTRAINT "candidate_profiles_anonymous_session_id_fkey"
  FOREIGN KEY ("anonymous_session_id") REFERENCES "anonymous_sessions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "candidate_profiles"
  ADD CONSTRAINT "candidate_profiles_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "candidate_profiles"
  ADD CONSTRAINT "candidate_profiles_source_application_id_fkey"
  FOREIGN KEY ("source_application_id") REFERENCES "applications"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "candidate_chunks"
  DROP CONSTRAINT IF EXISTS "candidate_chunks_application_id_fkey";
ALTER TABLE "candidate_chunks"
  DROP CONSTRAINT IF EXISTS "candidate_chunks_anonymous_session_id_fkey";

DROP INDEX IF EXISTS "candidate_chunks_anonymous_session_id_application_id_idx";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidate_chunks' AND column_name = 'application_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'candidate_chunks' AND column_name = 'source_application_id'
  ) THEN
    ALTER TABLE "candidate_chunks"
      RENAME COLUMN "application_id" TO "source_application_id";
  END IF;
END $$;

ALTER TABLE "candidate_chunks"
  ALTER COLUMN "anonymous_session_id" DROP NOT NULL,
  ALTER COLUMN "source_application_id" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "user_id" TEXT,
  ADD COLUMN IF NOT EXISTS "source_key" TEXT,
  ADD COLUMN IF NOT EXISTS "source_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "content_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "embedded_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3);

UPDATE "candidate_chunks"
SET
  "last_seen_at" = COALESCE("last_seen_at", "created_at", CURRENT_TIMESTAMP),
  "updated_at" = COALESCE("updated_at", "created_at", CURRENT_TIMESTAMP),
  "embedded_at" = CASE
    WHEN "embedding" IS NOT NULL THEN COALESCE("embedded_at", "created_at", CURRENT_TIMESTAMP)
    ELSE "embedded_at"
  END,
  "source_key" = COALESCE(
    "source_key",
    CONCAT("source_type"::text, ':', COALESCE("source_application_id", 'unknown-app'), ':', COALESCE("source_id", "id"))
  ),
  "source_hash" = COALESCE(
    "source_hash",
    md5(CONCAT_WS(E'\n', "source_type"::text, COALESCE("source_id", ''), COALESCE("metadata_json"::text, '')))
  ),
  "content_hash" = COALESCE("content_hash", md5(COALESCE("content", '')));

CREATE INDEX IF NOT EXISTS "candidate_chunks_anonymous_session_id_idx"
  ON "candidate_chunks"("anonymous_session_id");
CREATE INDEX IF NOT EXISTS "candidate_chunks_user_id_idx"
  ON "candidate_chunks"("user_id");
CREATE INDEX IF NOT EXISTS "candidate_chunks_source_application_id_idx"
  ON "candidate_chunks"("source_application_id");
CREATE INDEX IF NOT EXISTS "candidate_chunks_source_key_idx"
  ON "candidate_chunks"("source_key");
CREATE INDEX IF NOT EXISTS "candidate_chunks_content_hash_idx"
  ON "candidate_chunks"("content_hash");

CREATE UNIQUE INDEX IF NOT EXISTS "candidate_chunks_user_content_hash_active_key"
  ON "candidate_chunks"("user_id", "content_hash")
  WHERE "user_id" IS NOT NULL AND "content_hash" IS NOT NULL AND "archived_at" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "candidate_chunks_session_content_hash_active_key"
  ON "candidate_chunks"("anonymous_session_id", "content_hash")
  WHERE "user_id" IS NULL AND "anonymous_session_id" IS NOT NULL AND "content_hash" IS NOT NULL AND "archived_at" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "candidate_chunks_user_source_key_active_key"
  ON "candidate_chunks"("user_id", "source_key")
  WHERE "user_id" IS NOT NULL AND "source_key" IS NOT NULL AND "archived_at" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "candidate_chunks_session_source_key_active_key"
  ON "candidate_chunks"("anonymous_session_id", "source_key")
  WHERE "user_id" IS NULL AND "anonymous_session_id" IS NOT NULL AND "source_key" IS NOT NULL AND "archived_at" IS NULL;

ALTER TABLE "candidate_chunks"
  ADD CONSTRAINT "candidate_chunks_anonymous_session_id_fkey"
  FOREIGN KEY ("anonymous_session_id") REFERENCES "anonymous_sessions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "candidate_chunks"
  ADD CONSTRAINT "candidate_chunks_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "candidate_chunks"
  ADD CONSTRAINT "candidate_chunks_source_application_id_fkey"
  FOREIGN KEY ("source_application_id") REFERENCES "applications"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
