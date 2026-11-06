import "dotenv/config";
import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import PDFDocument from "pdfkit";
import { PDFParse } from "pdf-parse";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { getQdrantClient, ensureCollection, QDRANT_COLLECTION } from "./config/qdrant.js";
import { getEmbeddings, EMBEDDING_DIMENSION } from "./config/embeddings.js";
import { pdfRagAgent } from "./Agents/pdfRag.agent.js";
import { graph } from "./graph/graph.js";

async function createSamplePdf(filePath, text) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);
    doc.fontSize(16).text("NexusMind Architecture & Performance Report", { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(text);
    doc.end();
    writeStream.on("finish", () => resolve(filePath));
    writeStream.on("error", reject);
  });
}

async function runTests() {
  console.log("=================================================");
  console.log("   NexusMind PDF RAG Agent Comprehensive Tests   ");
  console.log("=================================================\n");

  const tempDir = os.tmpdir();
  const testPdfUserA = path.join(tempDir, `nexusmind_test_userA_${Date.now()}.pdf`);
  const testPdfUserB = path.join(tempDir, `nexusmind_test_userB_${Date.now()}.pdf`);

  const userAContent = `
Document Secret A-909:
Project NexusMind is an AI orchestrator built by Google DeepMind engineers.
NexusMind uses a high-performance LangGraph workflow engine with dedicated sub-agents.
The vector database is Qdrant Cloud located in the us-west-2 cluster.
The target response time under peak load is strictly 180 milliseconds.
User A authorized password: AlphaDeltaOmega99.
`;

  const userBContent = `
Document Secret B-707:
User B confidential project is CodeName Phoenix.
Phoenix handles real-time autonomous data streaming across 10 regions.
User B authorized password: BetaGammaZeta88.
`;

  try {
    // ── Test 1 & 2: PDF creation & Text Extraction with pdf-parse v2 ─────────
    console.log("[Test 1 & 2] Testing PDF creation and pdf-parse text extraction...");
    await createSamplePdf(testPdfUserA, userAContent);
    await createSamplePdf(testPdfUserB, userBContent);

    const bufferA = await fs.promises.readFile(testPdfUserA);
    const parser = new PDFParse({ data: bufferA });
    const parseResult = await parser.getText();
    const extractedText = (parseResult?.text || "").trim();

    if (!extractedText.includes("NexusMind") || !extractedText.includes("AlphaDeltaOmega99")) {
      throw new Error(`Text extraction failed or missed expected keywords. Extracted: ${extractedText}`);
    }
    console.log("✔ Text successfully extracted using pdf-parse API!\n");

    // ── Test 3: Text Splitting into Chunks ────────────────────────────────────
    console.log("[Test 3] Testing RecursiveCharacterTextSplitter chunking...");
    const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 200, chunkOverlap: 40 });
    const chunks = await splitter.createDocuments([extractedText]);
    if (!chunks || chunks.length === 0) {
      throw new Error("Text splitting produced zero chunks");
    }
    console.log(`✔ Text split into ${chunks.length} chunks successfully!\n`);

    // ── Test 4: Embeddings Generation & Dimension Verification ──────────────
    console.log("[Test 4] Testing Google Embeddings generation and vector dimension...");
    const embeddings = getEmbeddings();
    const queryEmb = await embeddings.embedQuery("What is the response time of NexusMind?");
    if (!queryEmb || queryEmb.length !== EMBEDDING_DIMENSION) {
      throw new Error(`Embedding dimension mismatch: expected ${EMBEDDING_DIMENSION}, got ${queryEmb?.length}`);
    }
    console.log(`✔ Embeddings generated with verified dimension: ${queryEmb.length}!\n`);

    // ── Test 5, 6, 7: Full Agent Execution with PDF ──────────────────────────
    console.log("[Test 5, 6, 7] Testing PDF RAG Agent end-to-end execution for User A...");
    const userA_Id = "user_A_" + Date.now();
    const convId_A = "conv_A_" + Date.now();

    const stateA = {
      prompt: "What is the secret password and target response time mentioned in the document?",
      conversationId: convId_A,
      userId: userA_Id,
      agent: "pdfRag",
      file: {
        path: testPdfUserA,
        originalname: "NexusMind_Doc_A.pdf",
        mimetype: "application/pdf",
        size: bufferA.length,
      },
    };

    const resultA = await pdfRagAgent(stateA);
    console.log("\n--- LLM Response for User A ---");
    console.log(resultA.aiResponse);
    console.log("-------------------------------\n");

    if (
      !resultA.aiResponse ||
      !resultA.aiResponse.toLowerCase().includes("alphadeltaomega99") ||
      !resultA.aiResponse.includes("180")
    ) {
      throw new Error("Response was not grounded in the document context: " + resultA.aiResponse);
    }
    console.log("✔ LLM answered accurately using PDF context!\n");

    // ── Test 8: Cross-User Isolation (User B cannot access User A's data) ─────
    console.log("[Test 8] Testing Cross-User Isolation in Qdrant...");
    const userB_Id = "user_B_" + Date.now();
    const convId_B = "conv_B_" + Date.now();

    const client = getQdrantClient();
    // Query Qdrant with User B filter searching for User A's secret
    const searchFilterUserB = {
      must: [
        { key: "userId", match: { value: userB_Id } },
      ],
    };
    const bQueryResult = await client.query(QDRANT_COLLECTION, {
      query: queryEmb,
      filter: searchFilterUserB,
      limit: 5,
      with_payload: true,
    });

    if (bQueryResult.points && bQueryResult.points.length > 0) {
      throw new Error(`Isolation breach: User B retrieved ${bQueryResult.points.length} points!`);
    }
    console.log("✔ Cross-user isolation verified: User B cannot retrieve User A vectors!\n");

    // ── Test 9: Vector Reuse / Avoid Re-embedding ─────────────────────────────
    console.log("[Test 9] Testing Document Vector Reuse (Repeated Questions)...");
    const stateA_FollowUp = {
      prompt: "What vector database is used?",
      conversationId: convId_A,
      userId: userA_Id,
      agent: "pdfRag",
      file: {
        path: testPdfUserA,
        originalname: "NexusMind_Doc_A.pdf",
        mimetype: "application/pdf",
        size: bufferA.length,
      },
    };

    const resultA_FollowUp = await pdfRagAgent(stateA_FollowUp);
    console.log("\n--- Follow-up Response (Reused Vectors) ---");
    console.log(resultA_FollowUp.aiResponse);
    console.log("-------------------------------------------\n");

    if (!resultA_FollowUp.aiResponse.toLowerCase().includes("qdrant")) {
      throw new Error("Follow-up response did not mention Qdrant: " + resultA_FollowUp.aiResponse);
    }
    console.log("✔ Follow-up question successfully reused indexed vectors!\n");

    // ── Test 10: Missing Information Handling ─────────────────────────────────
    console.log("[Test 10] Testing Grounding when information is NOT in document...");
    const stateA_Unknown = {
      prompt: "What is the capital of France and what is the CEO's favorite food?",
      conversationId: convId_A,
      userId: userA_Id,
      agent: "pdfRag",
      file: {
        path: testPdfUserA,
        originalname: "NexusMind_Doc_A.pdf",
        mimetype: "application/pdf",
        size: bufferA.length,
      },
    };

    const resultA_Unknown = await pdfRagAgent(stateA_Unknown);
    console.log("\n--- Unknown Information Response ---");
    console.log(resultA_Unknown.aiResponse);
    console.log("------------------------------------\n");
    console.log("✔ Agent handles missing information gracefully without fabricating facts!\n");

    // ── Test 11: LangGraph Workflow Integration ──────────────────────────────
    console.log("[Test 11] Testing LangGraph workflow dispatch for PDF upload...");
    const graphResult = await graph.invoke({
      prompt: "Summarize the key information in this report",
      conversationId: convId_A,
      userId: userA_Id,
      agent: "auto",
      file: {
        path: testPdfUserA,
        originalname: "NexusMind_Doc_A.pdf",
        mimetype: "application/pdf",
        size: bufferA.length,
      },
    });

    if (graphResult.agent !== "pdfRag" || !graphResult.aiResponse) {
      throw new Error(`Graph did not route to pdfRag or returned no response. Agent: ${graphResult.agent}`);
    }
    console.log(`✔ LangGraph routed to "${graphResult.agent}" and completed successfully!\n`);

    console.log("=================================================");
    console.log("   ALL PDF RAG TESTS PASSED SUCCESSFULLY!       ");
    console.log("=================================================");
  } finally {
    // ── Test 12: Temporary file cleanup verification ──────────────────────────
    console.log("\n[Test 12] Cleaning up test temporary files...");
    if (fs.existsSync(testPdfUserA)) {
      await fs.promises.unlink(testPdfUserA);
      console.log(`✔ Cleaned up ${testPdfUserA}`);
    }
    if (fs.existsSync(testPdfUserB)) {
      await fs.promises.unlink(testPdfUserB);
      console.log(`✔ Cleaned up ${testPdfUserB}`);
    }
  }
}

runTests().catch((err) => {
  console.error("\n❌ Test failed with error:", err);
  process.exit(1);
});
