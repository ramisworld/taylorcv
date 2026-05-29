import "server-only";

import { env } from "../env.js";

type JsonSchema = Record<string, unknown>;

type ResponsesApiBody = {
  model: string;
  input: Array<{ role: "system" | "user"; content: string }>;
  temperature?: number;
  text: {
    format: {
      type: "json_schema";
      name: string;
      strict: true;
      schema: JsonSchema;
    };
  };
};

function parseJsonPayload(text: string, serviceName: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    const looksLikeHtml = /^\s*</.test(text);
    throw new Error(
      `${serviceName} returned ${looksLikeHtml ? "HTML" : "invalid JSON"} instead of JSON`
    );
  }
}

export function isMockAiEnabled() {
  return env.USE_MOCK_AI === "true";
}

export function getFastModel() {
  if (!env.OPENAI_FAST_MODEL) {
    throw new Error("OPENAI_FAST_MODEL is required when USE_MOCK_AI is false");
  }
  return env.OPENAI_FAST_MODEL;
}

export function getStrongModel() {
  if (!env.OPENAI_STRONG_MODEL) {
    throw new Error("OPENAI_STRONG_MODEL is required when USE_MOCK_AI is false");
  }
  return env.OPENAI_STRONG_MODEL;
}

export async function createStructuredJsonResponse(args: {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  schemaName: string;
  jsonSchema: JsonSchema;
  temperature?: number;
}) {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required when USE_MOCK_AI is false");
  }

  const body: ResponsesApiBody = {
    model: args.model,
    temperature: args.temperature,
    input: [
      { role: "system", content: args.systemPrompt },
      { role: "user", content: args.userPrompt },
    ],
    text: {
      format: {
        type: "json_schema",
        name: args.schemaName,
        strict: true,
        schema: args.jsonSchema,
      },
    },
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`OpenAI Responses API failed: ${responseText}`);
  }

  const data = parseJsonPayload(responseText, "OpenAI Responses API") as {
    output_text?: string;
    output?: Array<{
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };

  const outputText =
    data.output_text ??
    data.output
      ?.flatMap((item) => item.content ?? [])
      .find((content) => content.type === "output_text")?.text;

  if (!outputText) {
    throw new Error("OpenAI response did not include output text");
  }

  return parseJsonPayload(outputText, "OpenAI output text");
}

function sseDataLines(block: string) {
  return block
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart());
}

export async function streamStructuredJsonResponse(args: {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  schemaName: string;
  jsonSchema: JsonSchema;
  temperature?: number;
  onOutputTextDelta: (delta: string) => void | Promise<void>;
}) {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required when USE_MOCK_AI is false");
  }

  const body: ResponsesApiBody & { stream: true } = {
    model: args.model,
    temperature: args.temperature,
    input: [
      { role: "system", content: args.systemPrompt },
      { role: "user", content: args.userPrompt },
    ],
    stream: true,
    text: {
      format: {
        type: "json_schema",
        name: args.schemaName,
        strict: true,
        schema: args.jsonSchema,
      },
    },
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`OpenAI Responses API failed: ${await response.text()}`);
  }
  if (!response.body) {
    throw new Error("OpenAI streaming response did not include a body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  let outputText = "";

  while (true) {
    const chunk = await reader.read();
    pending += decoder.decode(chunk.value, { stream: !chunk.done });
    const blocks = pending.split(/\r?\n\r?\n/);
    pending = blocks.pop() ?? "";
    for (const block of blocks) {
      for (const data of sseDataLines(block)) {
        if (!data || data === "[DONE]") continue;
        const event = parseJsonPayload(data, "OpenAI streaming event") as {
          type?: string;
          delta?: string;
          error?: { message?: string };
        };
        if (event.type === "response.output_text.delta" && event.delta) {
          outputText += event.delta;
          await args.onOutputTextDelta(event.delta);
        }
        if (event.type === "error" || event.type === "response.error") {
          throw new Error(event.error?.message ?? "OpenAI streaming response failed");
        }
      }
    }
    if (chunk.done) break;
  }

  return parseJsonPayload(outputText, "OpenAI output text");
}


