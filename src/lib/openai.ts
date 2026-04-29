import "server-only";

import { env } from "../env.js";

type JsonSchema = Record<string, unknown>;

type ResponsesApiBody = {
  model: string;
  input: Array<{ role: "system" | "user"; content: string }>;
  text: {
    format: {
      type: "json_schema";
      name: string;
      strict: true;
      schema: JsonSchema;
    };
  };
};

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

export function getEmbeddingModel() {
  if (!env.OPENAI_EMBEDDING_MODEL) {
    throw new Error(
      "OPENAI_EMBEDDING_MODEL is required when USE_MOCK_AI is false"
    );
  }
  return env.OPENAI_EMBEDDING_MODEL;
}

export async function createStructuredJsonResponse(args: {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  schemaName: string;
  jsonSchema: JsonSchema;
}) {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required when USE_MOCK_AI is false");
  }

  const body: ResponsesApiBody = {
    model: args.model,
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

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI Responses API failed: ${errorText}`);
  }

  const data = (await response.json()) as {
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

  return JSON.parse(outputText) as unknown;
}

export async function createOpenAIEmbedding(text: string) {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required when USE_MOCK_AI is false");
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: getEmbeddingModel(),
      input: text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI Embeddings API failed: ${errorText}`);
  }

  const data = (await response.json()) as {
    data?: Array<{ embedding?: number[] }>;
  };

  const embedding = data.data?.[0]?.embedding;
  if (!embedding) {
    throw new Error("OpenAI embedding response did not include an embedding");
  }

  return embedding;
}
