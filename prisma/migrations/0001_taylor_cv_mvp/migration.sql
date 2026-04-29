CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE "ApplicationStatus" AS ENUM ('started', 'job_added', 'candidate_added', 'evidence_ready', 'questions_ready', 'answers_added', 'strategy_ready', 'cv_ready');
CREATE TYPE "RequirementType" AS ENUM ('skill', 'tool', 'responsibility', 'soft_skill', 'domain', 'keyword');
CREATE TYPE "Importance" AS ENUM ('high', 'medium', 'low');
CREATE TYPE "SourceType" AS ENUM ('profile', 'gap_answer', 'manual');
CREATE TYPE "ChunkType" AS ENUM ('project', 'skill', 'certification', 'education', 'experience', 'gap_answer', 'achievement');
CREATE TYPE "EvidenceConfidence" AS ENUM ('high', 'medium', 'weak', 'missing');
CREATE TYPE "GapQuestionStatus" AS ENUM ('unanswered', 'answered', 'skipped');
CREATE TYPE "ButtonAnswer" AS ENUM ('yes', 'kind_of', 'no', 'skip');
CREATE TYPE "AgentRunStatus" AS ENUM ('success', 'error');

CREATE TABLE "anonymous_sessions" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "anonymous_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "applications" (
  "id" TEXT NOT NULL,
  "anonymous_session_id" TEXT NOT NULL,
  "status" "ApplicationStatus" NOT NULL DEFAULT 'started',
  "current_step" TEXT NOT NULL DEFAULT 'started',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "jobs" (
  "id" TEXT NOT NULL,
  "application_id" TEXT NOT NULL,
  "raw_text" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "company" TEXT,
  "seniority" TEXT,
  "summary" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "job_requirements" (
  "id" TEXT NOT NULL,
  "job_id" TEXT NOT NULL,
  "type" "RequirementType" NOT NULL,
  "label" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "importance" "Importance" NOT NULL,
  CONSTRAINT "job_requirements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "candidate_profiles" (
  "id" TEXT NOT NULL,
  "anonymous_session_id" TEXT NOT NULL,
  "application_id" TEXT NOT NULL,
  "raw_cv_text" TEXT,
  "raw_background_text" TEXT,
  "summary" TEXT NOT NULL,
  "skills_json" JSONB NOT NULL,
  "projects_json" JSONB NOT NULL,
  "education_json" JSONB NOT NULL,
  "certifications_json" JSONB NOT NULL,
  "experience_json" JSONB NOT NULL,
  "tools_json" JSONB NOT NULL,
  "achievements_json" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "candidate_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "candidate_chunks" (
  "id" TEXT NOT NULL,
  "anonymous_session_id" TEXT NOT NULL,
  "application_id" TEXT NOT NULL,
  "candidate_profile_id" TEXT,
  "source_type" "SourceType" NOT NULL,
  "source_id" TEXT,
  "chunk_type" "ChunkType" NOT NULL,
  "content" TEXT NOT NULL,
  "embedding" vector(1536),
  "tags_json" JSONB NOT NULL,
  "metadata_json" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "candidate_chunks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "evidence_matches" (
  "id" TEXT NOT NULL,
  "application_id" TEXT NOT NULL,
  "job_requirement_id" TEXT NOT NULL,
  "candidate_chunk_id" TEXT,
  "similarity_score" DOUBLE PRECISION,
  "confidence" "EvidenceConfidence" NOT NULL,
  "reason" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "evidence_matches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "gap_questions" (
  "id" TEXT NOT NULL,
  "application_id" TEXT NOT NULL,
  "target_requirement_id" TEXT,
  "question" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "GapQuestionStatus" NOT NULL DEFAULT 'unanswered',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gap_questions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "gap_answers" (
  "id" TEXT NOT NULL,
  "gap_question_id" TEXT NOT NULL,
  "application_id" TEXT NOT NULL,
  "button_answer" "ButtonAnswer" NOT NULL,
  "elaboration" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gap_answers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cv_strategies" (
  "id" TEXT NOT NULL,
  "application_id" TEXT NOT NULL,
  "strategy_summary" TEXT NOT NULL,
  "target_positioning" TEXT NOT NULL,
  "section_order_json" JSONB NOT NULL,
  "emphasis_json" JSONB NOT NULL,
  "de_emphasis_json" JSONB NOT NULL,
  "evidence_to_use_json" JSONB NOT NULL,
  "warnings_json" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cv_strategies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cv_drafts" (
  "id" TEXT NOT NULL,
  "application_id" TEXT NOT NULL,
  "strategy_id" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "cv_json" JSONB NOT NULL,
  "cv_text" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cv_drafts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_runs" (
  "id" TEXT NOT NULL,
  "application_id" TEXT NOT NULL,
  "agent_name" TEXT NOT NULL,
  "input_summary" TEXT NOT NULL,
  "output_summary" TEXT NOT NULL,
  "status" "AgentRunStatus" NOT NULL,
  "error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "jobs_application_id_key" ON "jobs"("application_id");
CREATE UNIQUE INDEX "candidate_profiles_application_id_key" ON "candidate_profiles"("application_id");
CREATE INDEX "applications_anonymous_session_id_idx" ON "applications"("anonymous_session_id");
CREATE INDEX "job_requirements_job_id_idx" ON "job_requirements"("job_id");
CREATE INDEX "candidate_profiles_anonymous_session_id_idx" ON "candidate_profiles"("anonymous_session_id");
CREATE INDEX "candidate_chunks_anonymous_session_id_application_id_idx" ON "candidate_chunks"("anonymous_session_id", "application_id");
CREATE INDEX "candidate_chunks_candidate_profile_id_idx" ON "candidate_chunks"("candidate_profile_id");
CREATE INDEX "candidate_chunks_embedding_idx" ON "candidate_chunks" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);
CREATE INDEX "evidence_matches_application_id_idx" ON "evidence_matches"("application_id");
CREATE INDEX "evidence_matches_job_requirement_id_idx" ON "evidence_matches"("job_requirement_id");
CREATE INDEX "evidence_matches_candidate_chunk_id_idx" ON "evidence_matches"("candidate_chunk_id");
CREATE INDEX "gap_questions_application_id_idx" ON "gap_questions"("application_id");
CREATE INDEX "gap_questions_target_requirement_id_idx" ON "gap_questions"("target_requirement_id");
CREATE INDEX "gap_answers_application_id_idx" ON "gap_answers"("application_id");
CREATE INDEX "gap_answers_gap_question_id_idx" ON "gap_answers"("gap_question_id");
CREATE INDEX "cv_strategies_application_id_idx" ON "cv_strategies"("application_id");
CREATE INDEX "cv_drafts_application_id_idx" ON "cv_drafts"("application_id");
CREATE INDEX "cv_drafts_strategy_id_idx" ON "cv_drafts"("strategy_id");
CREATE INDEX "agent_runs_application_id_idx" ON "agent_runs"("application_id");

ALTER TABLE "applications" ADD CONSTRAINT "applications_anonymous_session_id_fkey" FOREIGN KEY ("anonymous_session_id") REFERENCES "anonymous_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_requirements" ADD CONSTRAINT "job_requirements_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate_profiles" ADD CONSTRAINT "candidate_profiles_anonymous_session_id_fkey" FOREIGN KEY ("anonymous_session_id") REFERENCES "anonymous_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate_profiles" ADD CONSTRAINT "candidate_profiles_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate_chunks" ADD CONSTRAINT "candidate_chunks_anonymous_session_id_fkey" FOREIGN KEY ("anonymous_session_id") REFERENCES "anonymous_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate_chunks" ADD CONSTRAINT "candidate_chunks_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "candidate_chunks" ADD CONSTRAINT "candidate_chunks_candidate_profile_id_fkey" FOREIGN KEY ("candidate_profile_id") REFERENCES "candidate_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "evidence_matches" ADD CONSTRAINT "evidence_matches_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evidence_matches" ADD CONSTRAINT "evidence_matches_job_requirement_id_fkey" FOREIGN KEY ("job_requirement_id") REFERENCES "job_requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "evidence_matches" ADD CONSTRAINT "evidence_matches_candidate_chunk_id_fkey" FOREIGN KEY ("candidate_chunk_id") REFERENCES "candidate_chunks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "gap_questions" ADD CONSTRAINT "gap_questions_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gap_questions" ADD CONSTRAINT "gap_questions_target_requirement_id_fkey" FOREIGN KEY ("target_requirement_id") REFERENCES "job_requirements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "gap_answers" ADD CONSTRAINT "gap_answers_gap_question_id_fkey" FOREIGN KEY ("gap_question_id") REFERENCES "gap_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gap_answers" ADD CONSTRAINT "gap_answers_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cv_strategies" ADD CONSTRAINT "cv_strategies_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cv_drafts" ADD CONSTRAINT "cv_drafts_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cv_drafts" ADD CONSTRAINT "cv_drafts_strategy_id_fkey" FOREIGN KEY ("strategy_id") REFERENCES "cv_strategies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
