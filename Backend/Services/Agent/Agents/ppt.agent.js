import { randomUUID } from "crypto";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getModel } from "../config/llmModels.js";
import { generatePpt } from "../utils/generatePpt.js";
import { uploadImage } from "../utils/cloudinaryUpload.js";
import { extractTokenUsage } from "../utils/extractTokens.js";

// ── Configuration ──────────────────────────────────────────────────────────────

const GENERATED_PPTS_FOLDER =
  process.env.CLOUDINARY_PPTS_FOLDER || "nexusmind/generated-presentations";

// ── System prompt ──────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert professional presentation designer.

Your task is to create well-structured, engaging presentation content based on the user's topic.

You MUST respond with ONLY a valid JSON object — no markdown fences, no explanations, no text before or after the JSON.

The JSON must follow this exact structure:
{
  "title": "Presentation Title",
  "subtitle": "Presentation Subtitle",
  "slides": [
    {
      "title": "Slide Heading",
      "points": [
        "First concise point",
        "Second concise point",
        "Third concise point",
        "Fourth concise point"
      ]
    }
  ]
}

Requirements:
- Generate EXACTLY 6 content slides.
- Each slide must have 4–6 concise, meaningful bullet points.
- Every slide must have a meaningful, specific title.
- Include a suitable presentation title and an informative subtitle.
- Each bullet point must be a complete thought (not a single word or fragment).
- Content must be accurate, relevant, and well-organised.
- Use clear, professional language appropriate for a business presentation.
- Do NOT include markdown formatting inside JSON strings.
- Do NOT return markdown code fences.
- Do NOT return explanations before or after the JSON.
- Return only valid JSON.`;

// ── LLM content generation ─────────────────────────────────────────────────────

/**
 * Ask the LLM to produce structured presentation JSON for the given topic.
 * Validates the response and returns a clean object.
 *
 * @param {string} userPrompt
 * @returns {Promise<{ title: string, subtitle: string, slides: Array<{ title: string, points: string[] }> }>}
 */
async function generatePresentationContent(userPrompt) {
  const llm = await getModel("ppt");

  const messages = [
    new SystemMessage(SYSTEM_PROMPT),
    new HumanMessage(
      `Create a comprehensive, professional presentation about: ${userPrompt}`
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

  // Strip accidental markdown fences
  const fenceMatch = raw.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch) raw = fenceMatch[1].trim();

  // Also strip if fences appear anywhere (model adds preamble)
  const innerFence = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (innerFence) raw = innerFence[1].trim();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error(
      "[PPT Agent] LLM did not return valid JSON. Raw output:\n",
      raw.slice(0, 500)
    );
    throw new Error("LLM returned malformed JSON — cannot generate presentation");
  }

  // Validate top-level shape
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Parsed content is not a JSON object");
  }
  if (typeof parsed.title !== "string" || !parsed.title.trim()) {
    throw new Error("Presentation content is missing a valid 'title' field");
  }
  if (!Array.isArray(parsed.slides) || parsed.slides.length === 0) {
    throw new Error("Presentation content is missing 'slides' array");
  }

  // Sanitise and validate slides
  const cleanSlides = parsed.slides
    .filter(
      (s) =>
        s &&
        typeof s.title === "string" &&
        s.title.trim() &&
        Array.isArray(s.points) &&
        s.points.length > 0
    )
    .map((s) => ({
      title: s.title.trim(),
      points: s.points
        .filter((p) => typeof p === "string" && p.trim())
        .map((p) => p.trim()),
    }))
    .filter((s) => s.points.length > 0);

  if (cleanSlides.length === 0) {
    throw new Error("All slides were invalid or empty after sanitisation");
  }

  // Enforce exactly 6 content slides
  // If LLM returned fewer, duplicate the last one to pad (with warning)
  // If it returned more, trim to 6
  let finalSlides = cleanSlides;
  if (finalSlides.length > 6) {
    console.warn(`[PPT Agent] LLM returned ${finalSlides.length} slides — trimming to 6`);
    finalSlides = finalSlides.slice(0, 6);
  } else if (finalSlides.length < 6) {
    console.warn(`[PPT Agent] LLM returned only ${finalSlides.length} slides — padding to 6`);
    while (finalSlides.length < 6) {
      const last = finalSlides[finalSlides.length - 1];
      finalSlides.push({
        title: `${last.title} (continued)`,
        points: last.points.slice(),
      });
    }
  }

  // Validate each slide has 4–6 points; pad or trim gracefully
  finalSlides = finalSlides.map((s) => {
    let pts = s.points;
    if (pts.length > 6) pts = pts.slice(0, 6);
    while (pts.length < 4) pts.push(pts[pts.length - 1] || "See related material.");
    return { ...s, points: pts };
  });

  return {
    title:    parsed.title.trim(),
    subtitle: typeof parsed.subtitle === "string" ? parsed.subtitle.trim() : "",
    slides:   finalSlides,
    usage,
  };
}

// ── Cloudinary upload ──────────────────────────────────────────────────────────

/**
 * Upload a PPTX buffer to Cloudinary.
 * PPTX files must be uploaded as resource_type "raw" for binary delivery.
 *
 * @param {Buffer} buffer
 * @param {string} title   — used to build a human-readable public_id
 * @returns {Promise<string>} secure_url
 */
async function uploadPptToCloudinary(buffer, title) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  // Include extension in public_id so Cloudinary preserves it in the URL
  const publicId = `${slug}-${randomUUID().slice(0, 8)}.pptx`;

  const result = await uploadImage(buffer, {
    folder:        GENERATED_PPTS_FOLDER,
    public_id:     publicId,
    resource_type: "raw",   // binary Office files must use "raw"
    overwrite:     false,
  });

  if (!result?.secure_url) {
    throw new Error("Cloudinary upload returned no secure_url");
  }

  console.log(`[PPT Agent] Uploaded to Cloudinary: ${result.secure_url}`);
  return result.secure_url;
}

// ── Main PPT Agent ─────────────────────────────────────────────────────────────

/**
 * PPT Agent — generates a professional PowerPoint presentation from the user's
 * prompt, uploads it to Cloudinary, and returns the download URL.
 *
 * Graph state fields used:
 *   state.prompt      — user's original request
 *   state.aiResponse  — readable assistant reply (Markdown)
 *   state.artifacts   — carries PPT metadata: [{ type:"ppt", title, url }]
 *   state.images      — preserved unchanged
 */
export const pptAgent = async (state) => {
  console.log(`[PPT Agent] Processing prompt: "${state.prompt}"`);

  // ── 1. Generate structured presentation content via LLM ──────────────────────
  let presContent;
  try {
    presContent = await generatePresentationContent(state.prompt);
    console.log(
      `[PPT Agent] Content generated — title: "${presContent.title}", slides: ${presContent.slides.length}`
    );
  } catch (err) {
    console.error(`[PPT Agent] Content generation failed: ${err.message}`);
    return {
      ...state,
      aiResponse:
        "⚠️ I was unable to generate presentation content for your request. Please try rephrasing and try again.",
      images: state.images || [],
    };
  }

  // ── 2. Generate PPTX buffer ──────────────────────────────────────────────────
  let pptBuffer;
  try {
    pptBuffer = await generatePpt(presContent);
    if (!pptBuffer || pptBuffer.length === 0) {
      throw new Error("generatePpt returned an empty buffer");
    }
    console.log(
      `[PPT Agent] PPTX buffer ready — ${(pptBuffer.length / 1024).toFixed(1)} KB`
    );
  } catch (err) {
    console.error(`[PPT Agent] PPTX generation failed: ${err.message}`);
    return {
      ...state,
      aiResponse:
        "⚠️ Presentation creation encountered an error. Please try again.",
      images: state.images || [],
    };
  }

  // ── 3. Upload to Cloudinary ──────────────────────────────────────────────────
  let pptUrl;
  try {
    pptUrl = await uploadPptToCloudinary(pptBuffer, presContent.title);
  } catch (err) {
    console.error(`[PPT Agent] Cloudinary upload failed: ${err.message}`);
    return {
      ...state,
      aiResponse:
        "⚠️ The presentation was generated but could not be uploaded. Please try again.",
      images: state.images || [],
    };
  }

  // ── 4. Build readable Markdown response ──────────────────────────────────────
  const slideSummary = presContent.slides
    .map((s, i) => `- **Slide ${i + 1}:** ${s.title}`)
    .join("\n");

  const aiResponse = `## 📊 PPT Generated Successfully

**Presentation:** ${presContent.title}

${presContent.subtitle ? `*${presContent.subtitle}*\n\n` : ""}**Slides included:**
${slideSummary}

[⬇️ Download Presentation](${pptUrl})

> The presentation has been saved to Cloudinary and will remain available via the link above.`;

  // ── 5. Return updated state ──────────────────────────────────────────────────
  // Store PPT metadata in artifacts using the same shape as PDF Agent:
  // { type: "ppt", title, url } — the existing artifactSchema supports this.
  const pptArtifact = { type: "ppt", title: presContent.title, url: pptUrl };

  return {
    ...state,
    aiResponse,
    images:    state.images || [],
    artifacts: [
      ...(Array.isArray(state.artifacts) ? state.artifacts : []),
      pptArtifact,
    ],
    ...(presContent?.usage ? { usage: presContent.usage } : {}),
  };
};
