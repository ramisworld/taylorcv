UPDATE "candidate_profiles"
SET "source_type" = CASE
  WHEN "profile_source" = 'linkedin_url' THEN 'linkedin'::"SourceType"
  WHEN "profile_source" = 'background' THEN 'background'::"SourceType"
  WHEN "profile_source" = 'manual' THEN 'manual'::"SourceType"
  ELSE 'cv_upload'::"SourceType"
END
WHERE "source_type" IS NULL;

WITH ranked_user_profiles AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "user_id", "content_hash"
      ORDER BY "last_seen_at" DESC, "created_at" DESC, "id" DESC
    ) AS rank
  FROM "candidate_profiles"
  WHERE "user_id" IS NOT NULL
    AND "content_hash" IS NOT NULL
    AND "archived_at" IS NULL
)
UPDATE "candidate_profiles"
SET "archived_at" = CURRENT_TIMESTAMP
FROM ranked_user_profiles
WHERE "candidate_profiles"."id" = ranked_user_profiles."id"
  AND ranked_user_profiles.rank > 1;

WITH ranked_session_profiles AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "anonymous_session_id", "content_hash"
      ORDER BY "last_seen_at" DESC, "created_at" DESC, "id" DESC
    ) AS rank
  FROM "candidate_profiles"
  WHERE "user_id" IS NULL
    AND "anonymous_session_id" IS NOT NULL
    AND "content_hash" IS NOT NULL
    AND "archived_at" IS NULL
)
UPDATE "candidate_profiles"
SET "archived_at" = CURRENT_TIMESTAMP
FROM ranked_session_profiles
WHERE "candidate_profiles"."id" = ranked_session_profiles."id"
  AND ranked_session_profiles.rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "candidate_profiles_user_content_hash_active_key"
  ON "candidate_profiles"("user_id", "content_hash")
  WHERE "user_id" IS NOT NULL AND "content_hash" IS NOT NULL AND "archived_at" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "candidate_profiles_session_content_hash_active_key"
  ON "candidate_profiles"("anonymous_session_id", "content_hash")
  WHERE "user_id" IS NULL AND "anonymous_session_id" IS NOT NULL AND "content_hash" IS NOT NULL AND "archived_at" IS NULL;
