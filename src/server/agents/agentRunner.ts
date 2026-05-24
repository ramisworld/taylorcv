import "server-only";

import { ZodError, type z } from "zod";

import {
  createStructuredJsonResponse,
  getFastModel,
  getStrongModel,
  isMockAiEnabled,
  streamStructuredJsonResponse,
} from "~/lib/openai";
import { db } from "~/server/db";

function summarize(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return (text ?? "").slice(0, 4000);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "Unknown error");
}

function isTransientAgentError(error: unknown) {
  if (error instanceof ZodError) return false;
  const maybeStatus =
    typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status)
      : null;
  if (maybeStatus && [429, 500, 502, 503, 504].includes(maybeStatus)) {
    return true;
  }

  return /(?:connection\s*(?:reset|termination)|disconnect|upstream|timeout|timed?\s*out|econnreset|etimedout|socket hang up|429|500|502|503|504|temporar(?:y|ily)|rate limit)/i.test(
    errorMessage(error)
  );
}

function failedStageForAgent(agentName: string) {
  if (/strategy/i.test(agentName)) return "strategy_generation";
  if (/writer|rewrite/i.test(agentName)) return "draft_generation";
  if (/quality/i.test(agentName)) return "quality_review";
  if (/layout/i.test(agentName)) return "layout_generation";
  if (/scoring/i.test(agentName)) return "evidence_scoring";
  if (/gap/i.test(agentName)) return "gap_questions";
  if (/chunk/i.test(agentName)) return "evidence_chunking";
  if (/profile/i.test(agentName)) return "candidate_profile";
  if (/job/i.test(agentName)) return "job_parsing";
  return "agent_call";
}

export async function runJsonAgent<TOutput>(args: {
  applicationId: string;
  agentName: string;
  model: "fast" | "strong";
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodType<TOutput>;
  jsonSchema: Record<string, unknown>;
  temperature?: number;
  failedStage?: string;
  normalizeRawOutput?: (rawOutput: unknown) => unknown;
  mockOutput: () => TOutput;
}): Promise<TOutput> {
  let rawOutput: unknown;
  let originalRawOutput: unknown;
  let retryCount = 0;
  const failedStage = args.failedStage ?? failedStageForAgent(args.agentName);

  try {
    if (isMockAiEnabled()) {
      rawOutput = args.mockOutput();
    } else {
      const maxRetries = 2;
      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try {
          rawOutput = await createStructuredJsonResponse({
            model: args.model === "fast" ? getFastModel() : getStrongModel(),
            systemPrompt: args.systemPrompt,
            userPrompt: args.userPrompt,
            schemaName: args.agentName.replace(/[^a-zA-Z0-9_-]/g, "_"),
            jsonSchema: args.jsonSchema,
            temperature: args.temperature,
          });
          break;
        } catch (error) {
          if (attempt >= maxRetries || !isTransientAgentError(error)) {
            throw error;
          }
          retryCount = attempt + 1;
          await wait(350 * 2 ** attempt);
        }
      }
    }

    originalRawOutput = rawOutput;
    if (args.normalizeRawOutput) {
      rawOutput = args.normalizeRawOutput(rawOutput);
    }

    const output = args.schema.parse(rawOutput);

    await db.agentRun.create({
      data: {
        applicationId: args.applicationId,
        agentName: args.agentName,
        inputSummary: summarize(args.userPrompt),
        outputSummary: summarize(output),
        status: "success",
      },
    });

    return output;
  } catch (error) {
    const message = errorMessage(error);
    const summary = `stage=${failedStage}; retries=${retryCount}; ${message}`;
    const failureData = {
      applicationId: args.applicationId,
      agentName: args.agentName,
      inputSummary: summarize(args.userPrompt),
      outputSummary: summarize({
        failedStage,
        retryCount,
        rawOutput: originalRawOutput ?? rawOutput ?? null,
        normalizedOutput: args.normalizeRawOutput ? rawOutput ?? null : undefined,
      }),
      error: summary,
    };

    await db.agentRun
      .create({
        data: {
          ...failureData,
          status: "failed",
        },
      })
      .catch(() =>
        db.agentRun
          .create({
            data: {
              ...failureData,
              status: "error",
              error: `logicalStatus=failed; ${summary}`,
            },
          })
          .catch(() => undefined)
      )
      .catch(() => undefined);

    throw error;
  }
}

export async function runStreamingJsonAgent<TOutput>(args: {
  applicationId: string;
  agentName: string;
  model: "fast" | "strong";
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodType<TOutput>;
  jsonSchema: Record<string, unknown>;
  temperature?: number;
  onRawOutputDelta: (delta: string) => void | Promise<void>;
  mockOutput: () => TOutput;
}): Promise<TOutput> {
  let rawOutput: unknown;
  try {
    if (isMockAiEnabled()) {
      rawOutput = args.mockOutput();
    } else {
      rawOutput = await streamStructuredJsonResponse({
        model: args.model === "fast" ? getFastModel() : getStrongModel(),
        systemPrompt: args.systemPrompt,
        userPrompt: args.userPrompt,
        schemaName: args.agentName.replace(/[^a-zA-Z0-9_-]/g, "_"),
        jsonSchema: args.jsonSchema,
        temperature: args.temperature,
        onOutputTextDelta: args.onRawOutputDelta,
      });
    }
    const output = args.schema.parse(rawOutput);
    await db.agentRun.create({
      data: {
        applicationId: args.applicationId,
        agentName: args.agentName,
        inputSummary: summarize(args.userPrompt),
        outputSummary: summarize(output),
        status: "success",
      },
    });
    return output;
  } catch (error) {
    const message = errorMessage(error);
    await db.agentRun
      .create({
        data: {
          applicationId: args.applicationId,
          agentName: args.agentName,
          inputSummary: summarize(args.userPrompt),
          outputSummary: summarize(rawOutput ?? null),
          status: "failed",
          error: message,
        },
      })
      .catch(() => undefined);
    throw error;
  }
}
