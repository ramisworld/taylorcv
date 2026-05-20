-- CreateEnum
CREATE TYPE "PlanFamily" AS ENUM ('free', 'pro', 'premium');

-- CreateEnum
CREATE TYPE "PlanVariant" AS ENUM ('free', 'annual', 'monthly');

-- CreateEnum
CREATE TYPE "BillingSubscriptionStatus" AS ENUM ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'paused', 'none');

-- CreateEnum
CREATE TYPE "StripeWebhookProcessingStatus" AS ENUM ('processing', 'processed', 'failed');

-- CreateEnum
CREATE TYPE "AbuseAction" AS ENUM ('account_create', 'sign_in', 'anonymous_analysis', 'free_cv_claim', 'checkout_create', 'password_reset', 'verification_resend');

-- CreateEnum
CREATE TYPE "AbuseDecision" AS ENUM ('allowed', 'throttled', 'blocked', 'flagged');

-- AlterTable
ALTER TABLE "anonymous_sessions" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "applications" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "candidate_chunks" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "candidate_profiles" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "cv_drafts" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
UPDATE "users"
SET "email" = COALESCE(NULLIF("email", ''), CONCAT('legacy+', "id", '@taylorcv.local')),
    "name" = COALESCE(NULLIF("name", ''), 'TaylorCV user')
WHERE "email" IS NULL OR "email" = '' OR "name" IS NULL OR "name" = '';

ALTER TABLE "users" ADD COLUMN     "email_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "image" TEXT,
ALTER COLUMN "clerk_user_id" DROP NOT NULL,
ALTER COLUMN "email" SET NOT NULL,
ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "name" SET DEFAULT '';

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "provider_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "id_token" TEXT,
    "access_token_expires_at" TIMESTAMP(3),
    "refresh_token_expires_at" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifications" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "stripe_subscription_schedule_id" TEXT,
    "active_plan_key" TEXT NOT NULL DEFAULT 'free',
    "plan_family" "PlanFamily" NOT NULL DEFAULT 'free',
    "plan_variant" "PlanVariant" NOT NULL DEFAULT 'free',
    "subscription_status" "BillingSubscriptionStatus" NOT NULL DEFAULT 'none',
    "price_id" TEXT,
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "commitment_start_at" TIMESTAMP(3),
    "commitment_end_at" TIMESTAMP(3),
    "commitment_active" BOOLEAN NOT NULL DEFAULT false,
    "quota_per_period" INTEGER NOT NULL DEFAULT 1,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cv_generation_usage" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "cv_draft_id" TEXT,
    "plan_key" TEXT NOT NULL,
    "billing_period_start" TIMESTAMP(3),
    "billing_period_end" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cv_generation_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stripe_webhook_events" (
    "id" TEXT NOT NULL,
    "stripe_event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3),
    "processing_status" "StripeWebhookProcessingStatus" NOT NULL DEFAULT 'processing',
    "error" TEXT,
    "payload_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "abuse_signal_events" (
    "id" TEXT NOT NULL,
    "action" "AbuseAction" NOT NULL,
    "decision" "AbuseDecision" NOT NULL DEFAULT 'allowed',
    "user_id" TEXT,
    "anonymous_session_id" TEXT,
    "device_key_hash" TEXT,
    "ip_key_hash" TEXT,
    "metadata_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "abuse_signal_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");

-- CreateIndex
CREATE INDEX "verifications_identifier_idx" ON "verifications"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "billing_accounts_user_id_key" ON "billing_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_accounts_stripe_customer_id_key" ON "billing_accounts"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_accounts_stripe_subscription_id_key" ON "billing_accounts"("stripe_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_accounts_stripe_subscription_schedule_id_key" ON "billing_accounts"("stripe_subscription_schedule_id");

-- CreateIndex
CREATE INDEX "billing_accounts_stripe_customer_id_idx" ON "billing_accounts"("stripe_customer_id");

-- CreateIndex
CREATE INDEX "billing_accounts_stripe_subscription_id_idx" ON "billing_accounts"("stripe_subscription_id");

-- CreateIndex
CREATE INDEX "billing_accounts_active_plan_key_idx" ON "billing_accounts"("active_plan_key");

-- CreateIndex
CREATE INDEX "cv_generation_usage_user_id_created_at_idx" ON "cv_generation_usage"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "cv_generation_usage_user_id_billing_period_start_billing_pe_idx" ON "cv_generation_usage"("user_id", "billing_period_start", "billing_period_end");

-- CreateIndex
CREATE INDEX "cv_generation_usage_application_id_idx" ON "cv_generation_usage"("application_id");

-- CreateIndex
CREATE INDEX "cv_generation_usage_cv_draft_id_idx" ON "cv_generation_usage"("cv_draft_id");

-- CreateIndex
CREATE UNIQUE INDEX "stripe_webhook_events_stripe_event_id_key" ON "stripe_webhook_events"("stripe_event_id");

-- CreateIndex
CREATE INDEX "stripe_webhook_events_event_type_idx" ON "stripe_webhook_events"("event_type");

-- CreateIndex
CREATE INDEX "stripe_webhook_events_processing_status_idx" ON "stripe_webhook_events"("processing_status");

-- CreateIndex
CREATE INDEX "abuse_signal_events_action_created_at_idx" ON "abuse_signal_events"("action", "created_at");

-- CreateIndex
CREATE INDEX "abuse_signal_events_user_id_action_created_at_idx" ON "abuse_signal_events"("user_id", "action", "created_at");

-- CreateIndex
CREATE INDEX "abuse_signal_events_anonymous_session_id_action_created_at_idx" ON "abuse_signal_events"("anonymous_session_id", "action", "created_at");

-- CreateIndex
CREATE INDEX "abuse_signal_events_device_key_hash_action_created_at_idx" ON "abuse_signal_events"("device_key_hash", "action", "created_at");

-- CreateIndex
CREATE INDEX "abuse_signal_events_ip_key_hash_action_created_at_idx" ON "abuse_signal_events"("ip_key_hash", "action", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_accounts" ADD CONSTRAINT "billing_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cv_generation_usage" ADD CONSTRAINT "cv_generation_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cv_generation_usage" ADD CONSTRAINT "cv_generation_usage_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cv_generation_usage" ADD CONSTRAINT "cv_generation_usage_cv_draft_id_fkey" FOREIGN KEY ("cv_draft_id") REFERENCES "cv_drafts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "job_requirements_query_embedding_model_query_embedding_input_ha" RENAME TO "job_requirements_query_embedding_model_query_embedding_inpu_idx";
