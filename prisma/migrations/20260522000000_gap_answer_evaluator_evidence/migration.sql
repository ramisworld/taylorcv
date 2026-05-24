ALTER TABLE "gap_answers"
ADD COLUMN "user_id" TEXT,
ADD COLUMN "target_requirement_id" TEXT,
ADD COLUMN "raw_user_answer" TEXT,
ADD COLUMN "extracted_evidence_summary" TEXT,
ADD COLUMN "original_question" TEXT,
ADD COLUMN "usable_status" TEXT,
ADD COLUMN "evidence_quality" TEXT,
ADD COLUMN "boost_percent" INTEGER,
ADD COLUMN "source" TEXT;

CREATE INDEX "gap_answers_user_id_idx" ON "gap_answers"("user_id");
CREATE INDEX "gap_answers_target_requirement_id_idx" ON "gap_answers"("target_requirement_id");
