const VECTOR_DIMENSIONS = 1536;

const keywordFeatures: Array<{ dimension: number; terms: string[] }> = [
  { dimension: 0, terms: ["rag", "retrieval", "retrieval augmented"] },
  { dimension: 1, terms: ["agent", "agents", "agentic", "tool calling"] },
  { dimension: 2, terms: ["openai", "gpt", "llm", "model"] },
  { dimension: 3, terms: ["postgres", "postgresql"] },
  { dimension: 4, terms: ["pgvector", "vector", "embedding", "embeddings"] },
  { dimension: 5, terms: ["nextjs", "next.js", "react"] },
  { dimension: 6, terms: ["typescript", "typeScript", "ts"] },
  { dimension: 7, terms: ["deployment", "deploy", "hosted", "server", "ollama"] },
  { dimension: 8, terms: ["workflow", "orchestration", "pipeline"] },
  { dimension: 9, terms: ["prisma", "trpc", "t3"] },
];

export function createMockEmbedding(text: string) {
  const normalizedText = text.toLowerCase();
  const vector = Array<number>(VECTOR_DIMENSIONS).fill(0);
  let hasSignal = false;

  for (const feature of keywordFeatures) {
    const matchedTerms = feature.terms.filter((term) =>
      normalizedText.includes(term.toLowerCase())
    );
    if (matchedTerms.length > 0) {
      vector[feature.dimension] = matchedTerms.length;
      hasSignal = true;
    }
  }

  if (!hasSignal) {
    vector[VECTOR_DIMENSIONS - 1] = 1;
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return vector.map((value) => value / norm);
}
