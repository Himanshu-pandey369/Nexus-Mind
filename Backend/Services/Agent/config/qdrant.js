import { QdrantClient } from "@qdrant/js-client-rest";

const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
export const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION || "nexusmind_pdf_rag";

let clientInstance = null;

/**
 * Returns a singleton instance of QdrantClient configured via environment variables.
 * Never hardcodes credentials.
 */
export function getQdrantClient() {
  if (!process.env.QDRANT_URL) {
    throw new Error("Missing QDRANT_URL environment variable");
  }
  if (!process.env.QDRANT_API_KEY) {
    throw new Error("Missing QDRANT_API_KEY environment variable");
  }

  if (!clientInstance) {
    clientInstance = new QdrantClient({
      url: process.env.QDRANT_URL,
      apiKey: process.env.QDRANT_API_KEY,
      checkCompatibility: false,
    });
  }

  return clientInstance;
}

/**
 * Ensures the target Qdrant collection and required payload indexes exist.
 * Configured with Cosine distance and matching vector dimensions.
 *
 * @param {QdrantClient} client
 * @param {string} collectionName
 * @param {number} vectorSize
 */
export async function ensureCollection(client, collectionName = QDRANT_COLLECTION, vectorSize = 768) {
  try {
    const collectionsRes = await client.getCollections();
    const exists = collectionsRes.collections.some((c) => c.name === collectionName);

    if (!exists) {
      console.log(`[Qdrant] Creating collection "${collectionName}" with vector size ${vectorSize}...`);
      await client.createCollection(collectionName, {
        vectors: {
          size: vectorSize,
          distance: "Cosine",
        },
      });
      console.log(`[Qdrant] Collection "${collectionName}" created successfully.`);
    }

    // Ensure payload indexes exist for strict user isolation and fast filtered search
    const indexFields = ["userId", "documentId", "conversationId"];
    for (const field of indexFields) {
      try {
        await client.createPayloadIndex(collectionName, {
          field_name: field,
          field_schema: "keyword",
          wait: true,
        });
      } catch (idxErr) {
        // Payload index might already exist
      }
    }
  } catch (err) {
    console.error(`[Qdrant] Error in ensureCollection: ${err.message}`);
    throw err;
  }
}
