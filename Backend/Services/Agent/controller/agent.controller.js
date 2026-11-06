import fs from "fs";
import axios from "axios";
import { graph } from "../graph/graph.js";
import { getMemory, addMemory } from "../config/memory.js";
import cloudinary from "../config/cloudinary.js";
import { uploadImage } from "../utils/cloudinaryUpload.js";
import { getAgentCost } from "../config/agentPricing.js";
import {
  reserveCredits as reserveCreditsClient,
  commitCredits as commitCreditsClient,
  refundCredits as refundCreditsClient,
  recordUsage,
} from "../utils/creditClient.js";

const CHAT_SERVICE_URL = process.env.CHAT_SERVICE_URL || "http://localhost:8002";
const VALID_AGENTS = ["auto", "chat", "search", "coding", "pdf", "ppt", "vision", "imageAnalyzer", "pdfRag"];

// Helper to determine if an uploaded file is a PDF
const isPdfUpload = (file) => {
  if (!file) return false;
  const mime = (file.mimetype || "").toLowerCase();
  const name = (file.originalname || "").toLowerCase();
  return mime === "application/pdf" || name.endsWith(".pdf");
};

// Maximum credit cost across all agents — used when agent is "auto"
const MAX_AGENT_COST = 10;

/**
 * POST /agent/chat
 * Body: { prompt: string, conversationId: string, agent?: string }
 */
export const agentChat = async (req, res) => {
  const { prompt, conversationId, agent } = req.body;
  const userId = req.headers["x-user-id"];
  const tempFilePath = req.file?.path;

  try {
    // Require authenticated user ID
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Missing user identification header",
      });
    }

    // --- 1. Input validation ---
    const isPdf = isPdfUpload(req.file);
    const rawPrompt = typeof prompt === "string" ? prompt.trim() : "";
    const cleanPrompt = rawPrompt || (req.file ? (isPdf ? "Analyze this PDF" : "Analyze this image") : "");

    if (!cleanPrompt) {
      return res.status(400).json({
        success: false,
        message: "prompt is required and must be a non-empty string",
      });
    }

    if (
      !conversationId ||
      typeof conversationId !== "string" ||
      conversationId.trim() === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "conversationId is required and must be a non-empty string",
      });
    }

    // Validate agent selection if provided
    let selectedAgent = req.file ? (isPdf ? "pdfRag" : "imageAnalyzer") : "auto";
    if (agent !== undefined && agent !== null) {
      const normalizedAgent = agent.trim().toLowerCase();
      const matched = VALID_AGENTS.find((a) => a.toLowerCase() === normalizedAgent);
      if (typeof agent !== "string" || !matched) {
        return res.status(400).json({
          success: false,
          message: `Invalid agent requested. Must be one of: ${VALID_AGENTS.join(", ")}`,
        });
      }
      // If a file is uploaded, route to dedicated agent based on file type
      selectedAgent = req.file ? (isPdf ? "pdfRag" : "imageAnalyzer") : matched;
    }

    const cleanConvId = conversationId.trim();

  // --- 2. Load existing conversation history from Redis or Chat Service ---
  let history = [];
  try {
    history = await getMemory(cleanConvId);
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    console.error(`[Agent Controller] Failed to load history: ${msg}`);
    return res.status(502).json({
      success: false,
      message: "Failed to retrieve conversation history from Chat Service",
    });
  }

  // --- 3. Reserve credits before agent execution ---
  // If agent is "auto", reserve the maximum possible cost (10) since we don't
  // know the actual agent yet. If a specific agent is selected, reserve exact cost.
  // Fails fast if credits are insufficient or reservation cannot be established.
  const reserveCost = selectedAgent === "auto"
    ? MAX_AGENT_COST
    : (getAgentCost(selectedAgent) ?? MAX_AGENT_COST);

  let reservationId = null;
  console.log(
    `[Agent Controller] Reserving ${reserveCost} credits for user: ${userId}, agent: ${selectedAgent}`
  );

  try {
    const reservation = await reserveCreditsClient(
      userId,
      reserveCost,
      `${selectedAgent} agent request`
    );
    reservationId = reservation.reservationId;
    console.log(
      `[Agent Controller] Reserved ${reserveCost} credits for user ${userId}, reservation: ${reservationId}, balanceAfter: ${reservation.balanceAfter}`
    );
  } catch (err) {
    const status = err.response?.status;
    const message = err.response?.data?.message || err.message;
    console.error(
      `[Agent Controller] Credit reserve failed: ${message} (status: ${status})`
    );

    if (status === 402 || message === "Insufficient credits") {
      return res.status(402).json({
        success: false,
        message: "Insufficient credits. Please top up your account to continue.",
        requiredCredits: reserveCost,
      });
    }

    return res.status(status && status >= 400 && status < 600 ? status : 500).json({
      success: false,
      message: `Failed to reserve credits: ${message}`,
      requiredCredits: reserveCost,
    });
  }

  // --- 4. Invoke the LangGraph workflow ---
  let result;
  try {
    const filePayload = req.file
      ? {
          path: req.file.path,
          originalname: req.file.originalname,
          mimetype: req.file.mimetype,
          size: req.file.size,
        }
      : null;

    result = await graph.invoke({
      prompt: cleanPrompt,
      conversationId: cleanConvId,
      userId,
      history,
      agent: selectedAgent,
      file: filePayload,
    });
  } catch (err) {
    console.error("[Agent Controller] Graph invocation error:", err.message);

    // Refund reserved credits on graph failure
    if (reservationId && userId) {
      try {
        const refundRes = await refundCreditsClient(
          reservationId,
          userId,
          "Agent execution failed"
        );
        console.log(
          `[Agent Controller] Refund successful for reservation ${reservationId}. Balance after refund: ${refundRes.balance}`
        );
      } catch (refundErr) {
        console.error(
          "[Agent Controller] Credit refund failed:",
          refundErr.message
        );
      }
    }

    return res.status(500).json({
      success: false,
      message: "AI processing failed. Please try again.",
    });
  }

  const aiResponse = result?.aiResponse;
  const images = Array.isArray(result?.images) ? result.images : [];
  const artifacts = Array.isArray(result?.artifacts) ? result.artifacts : [];
  const actualAgent = result?.agent || selectedAgent;

  // --- 5. Verify AI response ---
  if (!aiResponse) {
    console.error("[Agent Controller] Graph returned no aiResponse");

    // Refund reserved credits — no useful output produced
    if (reservationId && userId) {
      try {
        const refundRes = await refundCreditsClient(
          reservationId,
          userId,
          "No AI response produced"
        );
        console.log(
          `[Agent Controller] Refund successful for reservation ${reservationId}. Balance after refund: ${refundRes.balance}`
        );
      } catch (err) {
        console.error("[Agent Controller] Credit refund failed:", err.message);
      }
    }

    return res.status(500).json({
      success: false,
      message: "No response generated by the AI agent",
    });
  }

  // --- 6. Persist user message and assistant response to Chat Service ---
  try {
    let userImages = [];
    if (req.file && tempFilePath && !isPdfUpload(req.file)) {
      try {
        const fileBuffer = await fs.promises.readFile(tempFilePath);
        const uploadRes = await uploadImage(fileBuffer, { folder: "nexusmind/user-uploads" });
        if (uploadRes?.secure_url) {
          userImages.push(uploadRes.secure_url);
        }
      } catch (uploadErr) {
        console.warn("[Agent Controller] Failed to upload user image to Cloudinary:", uploadErr.message);
      }
    }

    await axios.post(
      `${CHAT_SERVICE_URL}/chat/conversations/${cleanConvId}/messages`,
      {
        role: "user",
        content: cleanPrompt,
        ...(userImages.length > 0 ? { images: userImages } : {}),
      }
    );
    await axios.post(
      `${CHAT_SERVICE_URL}/chat/conversations/${cleanConvId}/messages`,
      { role: "assistant", content: aiResponse, images, artifacts }
    );
  } catch (err) {
    const msg = err.response?.data?.message || err.message;
    console.error(`[Agent Controller] Failed to save messages to Chat Service: ${msg}`);

    // Refund credits — message persistence failed
    if (reservationId && userId) {
      try {
        const refundRes = await refundCreditsClient(
          reservationId,
          userId,
          "Message persistence failed"
        );
        console.log(
          `[Agent Controller] Refund successful for reservation ${reservationId}. Balance after refund: ${refundRes.balance}`
        );
      } catch (refundErr) {
        console.error(
          "[Agent Controller] Credit refund failed:",
          refundErr.message
        );
      }
    }

    return res.status(502).json({
      success: false,
      message: "Failed to save message to Chat Service",
    });
  }

  // --- 7. Update Redis history cache ---
  try {
    await addMemory(cleanConvId, [
      { role: "user", content: cleanPrompt },
      { role: "assistant", content: aiResponse },
    ]);
  } catch (err) {
    console.warn("[Agent Controller] Failed to update Redis memory:", err.message);
  }

  // --- 8. Commit reserved credits ---
  let remainingBalance = null;
  if (reservationId && userId) {
    try {
      const actualCost = getAgentCost(actualAgent);
      console.log(
        `[Agent Controller] Committing reservation ${reservationId} for user ${userId}, actualAgent: ${actualAgent}, actualCost: ${actualCost}`
      );
      const commitRes = await commitCreditsClient(
        reservationId,
        userId,
        actualCost,
        `${actualAgent} agent completed (${actualCost} credits)`
      );
      remainingBalance = commitRes?.balance ?? null;
      console.log(
        `[Agent Controller] Commit successful for reservation ${reservationId}. Balance after commit: ${remainingBalance}`
      );
    } catch (err) {
      console.error(
        "[Agent Controller] Credit commit failed:",
        err.message
      );
    }
  }

  // --- 9. Record token usage (non-blocking, best-effort) ---
  if (userId) {
    const usage = result?.usage || {};
    const model =
      usage.model ||
      (actualAgent === "coding"
        ? "deepseek/deepseek-chat"
        : actualAgent === "imageAnalyzer"
        ? process.env.GEMINI_MODEL || "gemini-3.1-flash-lite"
        : actualAgent === "pdfRag"
        ? "openai/gpt-oss-120b"
        : "openai/gpt-oss-120b");
    const inputTokens = usage.inputTokens || 0;
    const outputTokens = usage.outputTokens || 0;
    const totalTokens = usage.totalTokens || (inputTokens + outputTokens);

    recordUsage({
      userId,
      conversationId: cleanConvId,
      agent: actualAgent,
      model,
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCost: 0, // Calculated on server or configured
      currency: "USD",
    });
  }

  return res.status(200).json({
    success: true,
    aiResponse,
    images,
    artifacts,
    credits: remainingBalance,
  });
  } finally {
    // --- 10. Clean up temporary files in a finally block, including on errors ---
    if (tempFilePath) {
      try {
        if (fs.existsSync(tempFilePath)) {
          await fs.promises.unlink(tempFilePath);
          console.log(`[Agent Controller] Cleaned up temporary file: ${tempFilePath}`);
        }
      } catch (cleanupErr) {
        console.warn(
          `[Agent Controller] Failed to delete temporary file ${tempFilePath}:`,
          cleanupErr.message
        );
      }
    }
  }
};

/**
 * GET /agent/pdf/download
 * Query parameters:
 *   - url: Cloudinary delivery URL
 *   - publicId: Cloudinary asset public ID
 *   - filename: Optional custom filename for Content-Disposition
 *
 * Securely streams the PDF from Cloudinary using authenticated signed URL,
 * avoiding Cloudinary CDN 401 ACL/delivery restrictions and protecting assets.
 */
export const downloadPDF = async (req, res) => {
  try {
    const { publicId, url, filename } = req.query;
    let targetPublicId = publicId;

    if (!targetPublicId && url) {
      const match = url.match(/\/(?:raw|image)\/upload\/(?:v\d+\/)?(.+?)(?:\?|$)/);
      if (match) {
        targetPublicId = decodeURIComponent(match[1]);
      }
    }

    if (!targetPublicId) {
      return res.status(400).json({
        success: false,
        message: "A valid 'publicId' or 'url' query parameter is required",
      });
    }

    const resourceType = url && url.includes("/image/upload/") ? "image" : "raw";

    // Generate authenticated signed download URL (valid for 1 hour)
    const signedUrl = cloudinary.utils.private_download_url(targetPublicId, "pdf", {
      resource_type: resourceType,
      type: "upload",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    });

    const upstreamResponse = await fetch(signedUrl);
    if (!upstreamResponse.ok) {
      return res.status(upstreamResponse.status).json({
        success: false,
        message: `Failed to fetch asset from Cloudinary: ${upstreamResponse.statusText}`,
      });
    }

    const arrayBuffer = await upstreamResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const safeFilename =
      filename ||
      targetPublicId.split("/").pop() ||
      "document.pdf";
    const finalFilename = safeFilename.endsWith(".pdf")
      ? safeFilename
      : `${safeFilename}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${finalFilename}"`);
    res.setHeader("Content-Length", buffer.length);

    return res.send(buffer);
  } catch (error) {
    console.error("[Agent Controller] PDF download error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to download PDF",
    });
  }
};

/**
 * GET /agent/ppt/download
 * Query parameters:
 *   - url: Cloudinary delivery URL for the PPTX (raw resource)
 *   - filename: Optional custom filename for Content-Disposition
 *
 * Streams the PPTX from Cloudinary using a signed URL to protect the asset.
 */
export const downloadPPT = async (req, res) => {
  try {
    const { url, filename } = req.query;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: "A valid 'url' query parameter is required",
      });
    }

    // Extract public ID from the raw Cloudinary URL
    // Format: https://res.cloudinary.com/<cloud>/raw/upload/v<ver>/<public_id>
    const match = url.match(/\/raw\/upload\/(?:v\d+\/)?(.+?)(?:\?|$)/);
    if (!match) {
      return res.status(400).json({
        success: false,
        message: "Could not extract Cloudinary public ID from the provided URL",
      });
    }

    const targetPublicId = decodeURIComponent(match[1]);

    // Generate authenticated signed download URL (valid for 1 hour)
    const signedUrl = cloudinary.utils.private_download_url(
      targetPublicId,
      "pptx",
      {
        resource_type: "raw",
        type: "upload",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      }
    );

    const upstreamResponse = await fetch(signedUrl);
    if (!upstreamResponse.ok) {
      return res.status(upstreamResponse.status).json({
        success: false,
        message: `Failed to fetch asset from Cloudinary: ${upstreamResponse.statusText}`,
      });
    }

    const arrayBuffer = await upstreamResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const safeFilename =
      filename ||
      targetPublicId.split("/").pop() ||
      "presentation.pptx";
    const finalFilename = safeFilename.endsWith(".pptx")
      ? safeFilename
      : `${safeFilename}.pptx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${finalFilename}"`);
    res.setHeader("Content-Length", buffer.length);

    return res.send(buffer);
  } catch (error) {
    console.error("[Agent Controller] PPT download error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to download presentation",
    });
  }
};
