ALTER TABLE "cv_strategies"
ADD COLUMN "strategy_json" JSONB;

ALTER TABLE "gap_questions"
ADD COLUMN "question_json" JSONB;

ALTER TABLE "gap_answers"
ADD COLUMN "selected_option" TEXT,
ADD COLUMN "follow_up_text" TEXT,
ADD COLUMN "metric_text" TEXT,
ADD COLUMN "skipped" BOOLEAN NOT NULL DEFAULT false;

UPDATE "gap_answers"
SET "skipped" = ("button_answer" = 'skip');

ALTER TABLE "candidate_profiles"
ADD COLUMN "caution_notes_json" JSONB,
ADD COLUMN "metric_opportunities_json" JSONB;

ALTER TABLE "evidence_matches"
ADD COLUMN "cv_usefulness" TEXT,
ADD COLUMN "claim_risk" TEXT;
