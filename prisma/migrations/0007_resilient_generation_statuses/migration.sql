ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'strategy_failed';
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'draft_failed';
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'draft_ready';
ALTER TYPE "AgentRunStatus" ADD VALUE IF NOT EXISTS 'failed';
