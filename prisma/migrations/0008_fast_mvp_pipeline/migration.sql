ALTER TABLE "applications"
  ADD COLUMN "match_label" TEXT,
  ADD COLUMN "cv_angle" TEXT,
  ADD COLUMN "role_archetype" TEXT,
  ADD COLUMN "match_analysis_json" JSONB;

ALTER TABLE "jobs"
  ADD COLUMN "role_domain" TEXT,
  ADD COLUMN "archetype_hint" TEXT;

ALTER TABLE "candidate_profiles"
  ADD COLUMN "strong_proof_candidates_json" JSONB,
  ADD COLUMN "scope_opportunities_json" JSONB,
  ADD COLUMN "likely_top_evidence_json" JSONB;

ALTER TABLE "cv_drafts"
  ADD COLUMN "builder_output_json" JSONB;
