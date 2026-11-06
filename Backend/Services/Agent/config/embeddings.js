import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "gemini-embedding-001";
export const EMBEDDING_DIMENSION = 768;

let embeddingsInstance = null;

/**
 * Returns a configured GoogleGenerativeAIEmbeddings instance with consistent model and 768 dimensions.
 */
export function getEmbeddings() {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GOOGLE_API_KEY environment variable for embeddings");
  }

  if (!embeddingsInstance) {
    embeddingsInstance = new GoogleGenerativeAIEmbeddings({
      apiKey,
      model: EMBEDDING_MODEL,
      outputDimensionality: EMBEDDING_DIMENSION,
    });
  }

  return embeddingsInstance;
}
