import { randomUUID } from "crypto";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getModel } from "../config/llmModels.js";
import { generatePDF } from "../utils/generatePDF.js";
import { uploadImage } from "../utils/cloudinaryUpload.js";
import { extractTokenUsage } from "../utils/extractTokens.js";

// ── Configuration ──────────────────────────────────────────────────────────────

const GENERATED_PDFS_FOLDER =
  process.env.CLOUDINARY_PDFS_FOLDER || "nexusmind/generated-pdfs";

// ── Structured-content generation ─────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert professional document writer.

Your task is to create well-structured, informative document content based on the user's topic.

You MUST respond with ONLY a valid JSON object — no markdown fences, no explanations, no text before or after the JSON.

The JSON must follow this exact structure:
{
  "title": "Clear, descriptive document title",
  "subtitle": "Informative subtitle that expands on the title",
  "sections": [
    {
      "heading": "Section Heading",
      "points": [
        "First concise, informative point",
        "Second concise, informative point",
        "Third concise, informative point"
      ]
    }
  ]
}

Requirements:
- Generate 4–8 sections appropriate for the topic.
- Each section must have 3–6 concise, meaningful bullet points.
- Each point should be a complete thought (not a single word).
- Content must be accurate, relevant, and well-organised.
- Use clear, professional language.
- Avoid unnecessary repetition between sections.
- Do NOT include markdown formatting inside the JSON strings.
- Return JSON only.`;

/**
 * Ask the LLM to produce structured document JSON for the given topic.
 * Validates and returns the parsed object.
 */
async function generateDocumentContent(userPrompt) {
  const llm = await getModel("pdf");

  const messages = [
    new SystemMessage(SYSTEM_PROMPT),
    new HumanMessage(
      `Create a comprehensive, professional document about: ${userPrompt}`
    ),
  ];

  let raw;
  let usage = null;
  try {
    const response = await llm.invoke(messages);
    raw = String(response.content).trim();
    usage = extractTokenUsage(response, "openai/gpt-oss-120b");
  } catch (err) {
    throw new Error(`LLM invocation failed: ${err.message}`);
  }

  // Strip accidental markdown fences if the model wraps its output
  const fenceMatch = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch) raw = fenceMatch[1].trim();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("[PDF Agent] LLM did not return valid JSON. Raw output:\n", raw.slice(0, 500));
    throw new Error("LLM returned malformed JSON — cannot generate PDF");
  }

  // Validate required fields
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Parsed content is not a JSON object");
  }
  if (typeof parsed.title !== "string" || !parsed.title.trim()) {
    throw new Error("Document content is missing a valid 'title' field");
  }
  if (!Array.isArray(parsed.sections) || parsed.sections.length === 0) {
    throw new Error("Document content is missing 'sections' array");
  }

  // Sanitise sections
  const cleanSections = parsed.sections
    .filter(
      (s) =>
        s &&
        typeof s.heading === "string" &&
        s.heading.trim() &&
        Array.isArray(s.points) &&
        s.points.length > 0
    )
    .map((s) => ({
      heading: s.heading.trim(),
      points: s.points
        .filter((p) => typeof p === "string" && p.trim())
        .map((p) => p.trim()),
    }))
    .filter((s) => s.points.length > 0);

  if (cleanSections.length === 0) {
    throw new Error("All sections were invalid or empty after sanitisation");
  }

  return {
    title:    parsed.title.trim(),
    subtitle: typeof parsed.subtitle === "string" ? parsed.subtitle.trim() : "",
    sections: cleanSections,
    usage,
  };
}

// ── Cloudinary upload ──────────────────────────────────────────────────────────

/**
 * Upload a PDF buffer to Cloudinary.
 * @param {Buffer} buffer
 * @param {string} title  — used to build a human-readable public_id
 * @returns {Promise<string>} secure_url
 */
async function uploadPDFToCloudinary(buffer, title) {
  // Slugify title for the public_id (keep it filesystem-safe)
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  const publicId = `${slug}-${randomUUID().slice(0, 8)}.pdf`;

  const result = await uploadImage(buffer, {
    folder:        GENERATED_PDFS_FOLDER,
    public_id:     publicId,
    resource_type: "raw",          // PDFs must use "raw" in Cloudinary
    format:        "pdf",
    overwrite:     false,
  });

  if (!result?.secure_url) {
    throw new Error("Cloudinary upload returned no secure_url");
  }

  console.log(`[PDF Agent] Uploaded to Cloudinary: ${result.secure_url}`);
  return result.secure_url;
}

// ── Main PDF Agent ─────────────────────────────────────────────────────────────

/**
 * PDF Agent — generates a professional PDF document from the user's prompt,
 * uploads it to Cloudinary, and returns the download URL.
 *
 * Graph state fields:
 *   state.prompt      — user's original request
 *   state.aiResponse  — readable assistant reply (Markdown)
 *   state.artifacts   — reused to carry PDF metadata: [{ type:"pdf", title, url }]
 *   state.images      — preserved unchanged
 */
export const pdfAgent = async (state) => {
  console.log(`[PDF Agent] Processing prompt: "${state.prompt}"`);

  // ── 1. Generate structured document content via LLM ─────────────────────────
  let docContent;
  try {
    docContent = await generateDocumentContent(state.prompt);
    console.log(
      `[PDF Agent] Content generated — title: "${docContent.title}", sections: ${docContent.sections.length}`
    );
  } catch (err) {
    console.error(`[PDF Agent] Content generation failed: ${err.message}`);
    return {
      ...state,
      aiResponse:
        "⚠️ I was unable to generate document content for your request. Please try rephrasing and try again.",
      images: state.images || [],
    };
  }

  // ── 2. Generate PDF buffer with PDFKit ───────────────────────────────────────
  let pdfBuffer;
  try {
    pdfBuffer = await generatePDF(docContent);
    if (!pdfBuffer || pdfBuffer.length === 0) {
      throw new Error("generatePDF returned an empty buffer");
    }
    console.log(
      `[PDF Agent] PDF buffer ready — ${(pdfBuffer.length / 1024).toFixed(1)} KB`
    );
  } catch (err) {
    console.error(`[PDF Agent] PDF generation failed: ${err.message}`);
    return {
      ...state,
      aiResponse:
        "⚠️ PDF creation encountered an error. Please try again.",
      images: state.images || [],
    };
  }

  // ── 3. Upload to Cloudinary ──────────────────────────────────────────────────
  let pdfUrl;
  try {
    pdfUrl = await uploadPDFToCloudinary(pdfBuffer, docContent.title);
  } catch (err) {
    console.error(`[PDF Agent] Cloudinary upload failed: ${err.message}`);
    return {
      ...state,
      aiResponse:
        "⚠️ The PDF was generated but could not be uploaded. Please try again.",
      images: state.images || [],
    };
  }

  // ── 4. Build readable Markdown response ──────────────────────────────────────
  const sectionSummary = docContent.sections
    .map((s) => `- **${s.heading}**`)
    .join("\n");

  const aiResponse = `## 📄 PDF Generated Successfully

**Title:** ${docContent.title}

${docContent.subtitle ? `*${docContent.subtitle}*\n\n` : ""}**Sections covered:**
${sectionSummary}

[⬇️ Download PDF](${pdfUrl})

> The document has been saved to Cloudinary and will remain available via the link above.`;

  // ── 5. Return updated state ──────────────────────────────────────────────────
  // We store PDF metadata in artifacts so it persists through Chat Service.
  // The artifact shape { type:"pdf", title, url } is consistent with the
  // existing artifacts array — it does NOT conflict with Coding Agent artifacts.
  const pdfArtifact = { type: "pdf", title: docContent.title, url: pdfUrl };

  return {
    ...state,
    aiResponse,
    images:    state.images || [],
    artifacts: [
      ...(Array.isArray(state.artifacts) ? state.artifacts : []),
      pdfArtifact,
    ],
    ...(docContent?.usage ? { usage: docContent.usage } : {}),
  };
};
