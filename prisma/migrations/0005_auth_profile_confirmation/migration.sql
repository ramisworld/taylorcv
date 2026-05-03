CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "clerk_user_id" TEXT NOT NULL,
  "email" TEXT,
  "name" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_clerk_user_id_key" ON "users"("clerk_user_id");

ALTER TABLE "applications"
ADD COLUMN "user_id" TEXT;

CREATE INDEX "applications_user_id_idx" ON "applications"("user_id");

ALTER TABLE "applications"
ADD CONSTRAINT "applications_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "candidate_profiles"
ADD COLUMN "contact_info_json" JSONB,
ADD COLUMN "links_json" JSONB,
ADD COLUMN "profile_source" TEXT,
ADD COLUMN "source_summary" TEXT,
ADD COLUMN "source_url" TEXT,
ADD COLUMN "profile_confirmed_at" TIMESTAMP(3);
