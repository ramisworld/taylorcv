import { env } from "../../env.js";
import { createMockEmbedding } from "./mockEmbedding.ts";

export function getActiveEmbeddingModelName() {
  return env.USE_MOCK_AI === "true"
    ? "mock-embedding"
    : env.OPENAI_EMBEDDING_MODEL;
}

export async function createEmbedding(text: string) {
  const embedding =
    env.USE_MOCK_AI === "true"
      ? createMockEmbedding(text)
      : await import("../../lib/openai.ts").then((module) =>
          module.createOpenAIEmbedding(text)
        );

  if (embedding.length !== 1536) {
    throw new Error(
      `Expected a 1536-dimension embedding, received ${embedding.length}`
    );
  }

  return embedding;
}

export async function createEmbeddings(texts: string[]) {
  const embeddings =
    env.USE_MOCK_AI === "true"
      ? texts.map((text) => createMockEmbedding(text))
      : await import("../../lib/openai.ts").then((module) =>
          module.createOpenAIEmbeddings(texts)
        );

  for (const embedding of embeddings) {
    if (embedding.length !== 1536) {
      throw new Error(
        `Expected a 1536-dimension embedding, received ${embedding.length}`
      );
    }
  }

  return embeddings;
}
