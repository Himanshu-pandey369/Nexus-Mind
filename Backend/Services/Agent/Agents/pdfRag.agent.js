import fs from "fs";
import crypto from "crypto";
import { PDFParse } from "pdf-parse";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getQdrantClient, ensureCollection, QDRANT_COLLECTION } from "../config/qdrant.js";
import { getEmbeddings, EMBEDDING_DIMENSION } from "../config/embeddings.js";
import { getModel } from "../config/llmModels.js";
import { extractTokenUsage } from "../utils/extractTokens.js";

const CHUNK_SIZE = parseInt(process.env.PDF_CHUNK_SIZE || "1000", 10);
const CHUNK_OVERLAP = parseInt(process.env.PDF_CHUNK_OVERLAP || "200", 10);
const TOP_K = parseInt(process.env.PDF_TOP_K || "5", 10);

/**
 * Generate a deterministic UUIDv4-like string for idempotent chunk points
 * based on userId, documentId, and chunkIndex.
 */
function getDeterministicPointId(userId, documentId, chunkIndex) {
  const hash = crypto
    .createHash("md5")
    .update(`${userId}:${documentId}:${chunkIndex}`)
    .digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

/**
 * PDF RAG Agent
 *
 * Implements the full pipeline:
 * PDF upload → PDF text extraction → chunking → embeddings → Qdrant
 * → similarity search (with strict user/doc isolation) → relevant context + user question → LLM response.
 */
export const pdfRagAgent = async (state) => {
  console.log("[PDF RAG Agent] Invoked with state:", {
    conversationId: state.conversationId,
    userId: state.userId,
    hasFile: Boolean(state.file?.path),
    filename: state.file?.originalname,
  });

  const userId = state.userId;
  if (!userId) {
    throw new Error("Missing authenticated user identification for PDF RAG");
  }

  const client = getQdrantClient();
  await ensureCollection(client, QDRANT_COLLECTION, EMBEDDING_DIMENSION);

  let documentId = state.documentId || null;
  let filename = state.file?.originalname || "document.pdf";

  // ── 1. Document Ingestion / Vector Reuse ──────────────────────────────────
  if (state.file && state.file.path) {
    const filePath = state.file.path;

    if (!fs.existsSync(filePath)) {
      throw new Error(`Uploaded file not found at path: ${filePath}`);
    }

    const fileBuffer = await fs.promises.readFile(filePath);
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error("The uploaded PDF file is empty (0 bytes).");
    }

    // Compute document hash (SHA-256) to identify this unique document safely
    documentId = crypto.createHash("sha256").update(fileBuffer).digest("hex");
    filename = state.file.originalname || "document.pdf";

    // Check if this document is already indexed in Qdrant for this user
    console.log(`[PDF RAG Agent] Checking existing index for user: ${userId}, doc: ${documentId}`);
    const existingIndex = await client.scroll(QDRANT_COLLECTION, {
      filter: {
        must: [
          { key: "userId", match: { value: userId } },
          { key: "documentId", match: { value: documentId } },
        ],
      },
      limit: 1,
      with_payload: false,
    });

    if (existingIndex?.points && existingIndex.points.length > 0) {
      console.log(
        `[PDF RAG Agent] Document "${filename}" (ID: ${documentId}) is already indexed for user ${userId}. Reusing existing vectors.`
      );
    } else {
      console.log(`[PDF RAG Agent] Extracting text from "${filename}"...`);

      // Extract text using pdf-parse v2 API
      let extractedText = "";
      try {
        const parser = new PDFParse({ data: fileBuffer });
        const parseResult = await parser.getText();
        extractedText = (parseResult?.text || "").trim();
      } catch (parseErr) {
        console.error("[PDF RAG Agent] PDF text extraction failed:", parseErr.message);
        throw new Error(
          `Failed to parse PDF document: ${parseErr.message || "Invalid or unreadable PDF structure"}`
        );
      }

      if (!extractedText || extractedText.length === 0) {
        throw new Error(
          "The uploaded PDF is empty or contains no readable text. If it is a scanned document, OCR is required."
        );
      }

      console.log(
        `[PDF RAG Agent] Successfully extracted ${extractedText.length} characters of text. Splitting into chunks...`
      );

      // Split text into chunks using RecursiveCharacterTextSplitter
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: CHUNK_SIZE,
        chunkOverlap: CHUNK_OVERLAP,
      });

      const docs = await splitter.createDocuments([extractedText]);
      if (!docs || docs.length === 0) {
        throw new Error("Failed to split document text into chunks.");
      }

      console.log(
        `[PDF RAG Agent] Created ${docs.length} chunks. Generating embeddings using Google Embeddings (${EMBEDDING_DIMENSION}d)...`
      );

      const embeddings = getEmbeddings();
      const chunkTexts = docs.map((d) => d.pageContent);

      // Generate embeddings in batches to prevent hitting rate limits on large files
      const vectors = [];
      const EMBED_BATCH_SIZE = 20;
      for (let i = 0; i < chunkTexts.length; i += EMBED_BATCH_SIZE) {
        const batchTexts = chunkTexts.slice(i, i + EMBED_BATCH_SIZE);
        const batchVectors = await embeddings.embedDocuments(batchTexts);
        vectors.push(...batchVectors);
      }

      // Verify embedding model vector dimensions are consistent
      if (!vectors || vectors.length === 0 || vectors[0].length !== EMBEDDING_DIMENSION) {
        throw new Error(
          `Embedding vector dimension mismatch: expected ${EMBEDDING_DIMENSION}, received ${vectors?.[0]?.length}`
        );
      }

      // Construct points for Qdrant with deterministic UUIDs
      const points = docs.map((doc, idx) => {
        const pointId = getDeterministicPointId(userId, documentId, idx);
        return {
          id: pointId,
          vector: vectors[idx],
          payload: {
            userId,
            documentId,
            conversationId: state.conversationId || "",
            filename,
            chunkIndex: idx,
            totalChunks: docs.length,
            text: doc.pageContent,
          },
        };
      });

      console.log(`[PDF RAG Agent] Upserting ${points.length} points into Qdrant collection "${QDRANT_COLLECTION}"...`);

      // Upsert in batches of 50
      for (let i = 0; i < points.length; i += 50) {
        const pointBatch = points.slice(i, i + 50);
        await client.upsert(QDRANT_COLLECTION, {
          wait: true,
          points: pointBatch,
        });
      }

      console.log(`[PDF RAG Agent] Successfully indexed document "${filename}" into Qdrant.`);
    }
  } else {
    // No new file attached: Check if there's an already-indexed document for this conversation or user
    console.log(`[PDF RAG Agent] No file attached. Looking up previously indexed document for user ${userId}...`);
    const filter = {
      must: [
        { key: "userId", match: { value: userId } },
        ...(state.conversationId ? [{ key: "conversationId", match: { value: state.conversationId } }] : []),
      ],
    };

    const prevPoints = await client.scroll(QDRANT_COLLECTION, {
      filter,
      limit: 1,
      with_payload: true,
    });

    if (!prevPoints?.points || prevPoints.points.length === 0) {
      return {
        ...state,
        aiResponse: "No PDF document was found. Please upload a PDF to ask questions about it.",
      };
    }

    documentId = prevPoints.points[0].payload.documentId;
    filename = prevPoints.points[0].payload.filename || "document.pdf";
    console.log(`[PDF RAG Agent] Found previous indexed document "${filename}" (ID: ${documentId}).`);
  }

  // ── 2. Similarity Search ──────────────────────────────────────────────────
  const userPrompt =
    state.prompt && state.prompt.trim()
      ? state.prompt.trim()
      : "Please summarize the main points of this document.";

  console.log(`[PDF RAG Agent] Generating query embedding for: "${userPrompt.slice(0, 80)}..."`);
  const embeddings = getEmbeddings();
  const queryVector = await embeddings.embedQuery(userPrompt);

  // Strict ownership isolation: ONLY search points belonging to this authenticated user
  const searchFilter = {
    must: [
      { key: "userId", match: { value: userId } },
      ...(documentId ? [{ key: "documentId", match: { value: documentId } }] : []),
    ],
  };

  console.log(`[PDF RAG Agent] Searching Qdrant with top_k=${TOP_K} and user isolation...`);
  const searchResult = await client.query(QDRANT_COLLECTION, {
    query: queryVector,
    filter: searchFilter,
    limit: TOP_K,
    with_payload: true,
  });

  const matchedPoints = searchResult?.points || [];
  console.log(`[PDF RAG Agent] Retrieved ${matchedPoints.length} matching chunks`);

  if (matchedPoints.length === 0) {
    return {
      ...state,
      documentId,
      aiResponse:
        "The uploaded PDF does not contain relevant information to answer this question.",
    };
  }

  const contextExcerpts = matchedPoints
    .map((p, i) => `[Excerpt ${i + 1} from ${p.payload?.filename || filename}]:\n${p.payload?.text}`)
    .join("\n\n---\n\n");

  // ── 3. LLM Response Generation ───────────────────────────────────────────
  const systemPrompt = `You are an expert AI document analyst.
Answer the user's question accurately, clearly, and concisely based strictly on the provided document context excerpts below.

Guidelines:
- Ground your entire answer strictly in the provided document context.
- If the document context does NOT contain enough information to answer the question, state: "The uploaded document does not contain sufficient information to answer this question." Do not fabricate or speculate.
- Cite specific facts, sections, or details from the excerpts where helpful.
- Present answers in a clean, professional markdown format.

Document Context:
${contextExcerpts}`;

  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(userPrompt),
  ];

  const llm = await getModel("pdfRag");
  const response = await llm.invoke(messages);

  const modelName =
    response?.response_metadata?.model_name || "openai/gpt-oss-120b";
  const tokenUsage = extractTokenUsage(response, modelName);

  console.log("[PDF RAG Agent] Response generated successfully");

  return {
    ...state,
    documentId,
    aiResponse: response.content,
    ...(tokenUsage ? { usage: tokenUsage } : {}),
  };
};
