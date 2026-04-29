import "server-only";

import type { z } from "zod";

import {
  createStructuredJsonResponse,
  getFastModel,
  getStrongModel,
  isMockAiEnabled,
} from "~/lib/openai";
import { db } from "~/server/db";

function summarize(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return (text ?? "").slice(0, 4000);
}

export async function runJsonAgent<TOutput>(args: {
  applicationId: string;
  agentName: string;
  model: "fast" | "strong";
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodType<TOutput>;
  jsonSchema: Record<string, unknown>;
  mockOutput: () => TOutput;
}): Promise<TOutput> {
  let rawOutput: unknown;

  try {
    rawOutput = isMockAiEnabled()
      ? args.mockOutput()
      : await createStructuredJsonResponse({
          model: args.model === "fast" ? getFastModel() : getStrongModel(),
          systemPrompt: args.systemPrompt,
          userPrompt: args.userPrompt,
          schemaName: args.agentName.replace(/[^a-zA-Z0-9_-]/g, "_"),
          jsonSchema: args.jsonSchema,
        });

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
    const message = error instanceof Error ? error.message : "Unknown error";

    await db.agentRun
      .create({
        data: {
          applicationId: args.applicationId,
          agentName: args.agentName,
          inputSummary: summarize(args.userPrompt),
          outputSummary: summarize(rawOutput ?? {}),
          status: "error",
          error: message,
        },
      })
      .catch(() => undefined);

    throw error;
  }
}
