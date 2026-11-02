import { randomUUID } from "crypto";
import { getModel } from "../config/llmModels.js";
import { uploadImage } from "../utils/cloudinaryUpload.js";

// ── Cloudflare Workers AI Configuration ──────────────────────────────────────

const CLOUDFLARE_MODEL_ID = "@cf/black-forest-labs/flux-1-schnell";

// Folder inside Cloudinary where generated images are stored
const GENERATED_IMAGES_FOLDER =
  process.env.CLOUDINARY_GENERATED_FOLDER || "nexusmind/generated-images";

// Timeout for the Cloudflare Workers AI request (60 seconds for image generation)
const IMAGE_FETCH_TIMEOUT_MS = 60_000;

// Maximum retry attempts for temporary failures (1 initial call + 2 retries)
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1_000;
const RETRY_BACKOFF_FACTOR = 2;

// ── Prompt enhancement ─────────────────────────────────────────────────────────

/**
 * Ask an LLM to transform the user's rough request into a rich, detailed
 * image-generation prompt. Returns the enhanced prompt string.
 * @param {string} userPrompt
 * @returns {Promise<string>}
 */
async function enhancePrompt(userPrompt) {
  const llm = await getModel("vision"); // → Groq (fast & cheap)

  const systemInstruction = `You are a professional AI image-prompt engineer.

Your job is to transform a user's rough image request into a detailed, vivid image-generation prompt.

Your enhanced prompt must include:
1. Clear subject and scene description
2. Composition and camera perspective (e.g. close-up, wide shot, bird's-eye view)
3. Lighting and atmosphere (e.g. golden hour, dramatic shadows, soft diffused light)
4. Color palette (e.g. warm earth tones, neon accents, muted pastels)
5. Visual style and artistic direction (e.g. photorealistic, oil painting, cinematic, anime)
6. Image quality descriptors (e.g. 8K, ultra-detailed, sharp focus, award-winning)

Rules:
- Return ONLY the enhanced image prompt — no explanations, no markdown, no preamble.
- Do not change or ignore the user's core subject or intent.
- Keep the result under 400 characters.`;

  const messages = [
    { role: "system", content: systemInstruction },
    { role: "user", content: userPrompt },
  ];

  const response = await llm.invoke(messages);
  const enhanced = String(response.content).trim();

  if (!enhanced) {
    throw new Error("LLM returned an empty prompt enhancement");
  }

  return enhanced;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Helper to pause execution for a given duration.
 * @param {number} ms
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Check whether an error is transient and safe to retry.
 * Permanent errors (400, 401, 403, 404, invalid inputs/credentials) are NOT retried.
 * @param {Error & { status?: number, isPermanent?: boolean }} error
 * @returns {boolean}
 */
function isTransientError(error) {
  if (error.isPermanent) return false;
  if (!error.status) return true; // Network timeouts, fetch errors, socket aborts
  // HTTP status codes that represent transient conditions
  return [429, 500, 502, 503, 504].includes(error.status);
}

// ── Cloudflare Workers AI Image Generation ────────────────────────────────────

/**
 * Perform a single HTTP request to Cloudflare Workers AI FLUX.1 Schnell model.
 * @param {string} prompt
 * @returns {Promise<Buffer>}
 */
async function callCloudflareWorkersAI(prompt) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();

  if (!accountId || !apiToken) {
    const error = new Error(
      "Missing Cloudflare Workers AI credentials (CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN must be configured)"
    );
    error.isPermanent = true;
    error.status = 401;
    throw error;
  }

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${CLOUDFLARE_MODEL_ID}`;

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
        Accept: "application/json, image/*",
      },
      body: JSON.stringify({ prompt, steps: 4 }),
      signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
    });
  } catch (networkErr) {
    if (networkErr.name === "TimeoutError" || networkErr.name === "AbortError") {
      const timeoutErr = new Error("Cloudflare Workers AI request timed out");
      timeoutErr.status = 504;
      throw timeoutErr;
    }
    const err = new Error(`Cloudflare Workers AI network error: ${networkErr.message}`);
    err.status = 0;
    throw err;
  }

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status} ${response.statusText}`;
    try {
      const errBody = await response.text();
      const parsed = JSON.parse(errBody);
      if (parsed.errors?.length) {
        errorMessage = parsed.errors.map((e) => e.message || e.code).join("; ");
      }
    } catch {
      // Keep default HTTP status message if body is not JSON
    }

    const error = new Error(`Cloudflare Workers AI error: ${errorMessage}`);
    error.status = response.status;
    if (response.headers.get("retry-after")) {
      const seconds = parseInt(response.headers.get("retry-after"), 10);
      if (!isNaN(seconds) && seconds > 0) {
        error.retryAfterMs = seconds * 1000;
      }
    }

    // Classify permanent HTTP client errors
    if ([400, 401, 403, 404].includes(response.status)) {
      error.isPermanent = true;
    }
    throw error;
  }

  // Parse response: handle either JSON containing base64 image or direct binary image
  const contentType = response.headers.get("content-type") || "";
  let imageBuffer;

  if (contentType.includes("application/json")) {
    const json = await response.json();
    if (!json.success && json.errors?.length) {
      const msg = json.errors.map((e) => e.message || e.code).join("; ");
      const error = new Error(`Cloudflare Workers AI error: ${msg}`);
      error.status = 400;
      error.isPermanent = true;
      throw error;
    }

    const base64Data = json.result?.image;
    if (!base64Data || typeof base64Data !== "string") {
      throw new Error("Cloudflare Workers AI response missing image data");
    }
    imageBuffer = Buffer.from(base64Data, "base64");
  } else {
    // Binary image response
    const arrayBuffer = await response.arrayBuffer();
    imageBuffer = Buffer.from(arrayBuffer);
  }

  if (!imageBuffer || imageBuffer.length === 0) {
    throw new Error("Cloudflare Workers AI returned an empty image buffer");
  }

  console.log(
    `[Vision Agent] Image received from Cloudflare Workers AI (${(
      imageBuffer.length / 1024
    ).toFixed(1)} KB)`
  );
  return imageBuffer;
}

/**
 * Fetch a generated image as a binary Buffer from Cloudflare Workers AI
 * with exponential backoff retry for transient failures.
 * @param {string} prompt
 * @returns {Promise<Buffer>}
 */
export async function generateImageWithRetry(prompt) {
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    const error = new Error("Invalid or empty prompt provided for image generation");
    error.isPermanent = true;
    error.status = 400;
    throw error;
  }

  let delay = INITIAL_RETRY_DELAY_MS;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(
        `[Vision Agent] Requesting image from Cloudflare Workers AI (attempt ${attempt}/${MAX_RETRIES})…`
      );
      return await callCloudflareWorkersAI(prompt.trim());
    } catch (err) {
      console.error(
        `[Vision Agent] Attempt ${attempt} failed: ${err.message} (status: ${err.status || "network"})`
      );

      // Do not retry permanent errors or if final attempt failed
      if (!isTransientError(err) || attempt === MAX_RETRIES) {
        throw err;
      }

      const waitTime = err.retryAfterMs || delay;
      console.warn(
        `[Vision Agent] Transient failure encountered. Retrying in ${waitTime}ms (attempt ${attempt}/${MAX_RETRIES})…`
      );
      await sleep(waitTime);
      delay *= RETRY_BACKOFF_FACTOR;
    }
  }
}

// ── Cloudinary upload ──────────────────────────────────────────────────────────

/**
 * Upload an image buffer to Cloudinary under the generated-images folder.
 * @param {Buffer} buffer
 * @returns {Promise<string>} Cloudinary secure URL
 */
async function uploadToCloudinary(buffer) {
  const publicId = `generated-${randomUUID()}`;

  const result = await uploadImage(buffer, {
    folder: GENERATED_IMAGES_FOLDER,
    public_id: publicId,
    resource_type: "image",
    overwrite: true,
  });

  if (!result?.secure_url) {
    throw new Error("Cloudinary upload succeeded but returned no secure_url");
  }

  console.log(`[Vision Agent] Image uploaded to Cloudinary: ${result.secure_url}`);
  return result.secure_url;
}

// ── Main Vision Agent ──────────────────────────────────────────────────────────

/**
 * Vision Agent — enhances the user's prompt, generates an image via
 * Cloudflare Workers AI (FLUX.1 Schnell), uploads it to Cloudinary,
 * and returns the secure URL.
 *
 * Graph state fields used:
 *   - state.prompt     : the user's original request
 *   - state.images     : array of image URL strings (extends existing array)
 *   - state.aiResponse : human-readable reply text
 */
export const visionAgent = async (state) => {
  console.log(`[Vision Agent] Processing prompt: "${state?.prompt}"`);

  // ── 0. Validate prompt ──────────────────────────────────────────────────────
  if (!state?.prompt || typeof state.prompt !== "string" || !state.prompt.trim()) {
    console.error("[Vision Agent] Empty or invalid prompt received");
    return {
      ...state,
      aiResponse: "⚠️ Please provide a prompt describing the image you want to generate.",
      images: state?.images || [],
    };
  }

  const rawPrompt = state.prompt.trim();

  // ── 1. Enhance the user's prompt ────────────────────────────────────────────
  let generationPrompt = rawPrompt;
  try {
    generationPrompt = await enhancePrompt(rawPrompt);
    console.log(`[Vision Agent] Enhanced prompt: "${generationPrompt}"`);
  } catch (err) {
    console.warn(
      `[Vision Agent] Prompt enhancement failed (${err.message}); continuing with original prompt`
    );
    generationPrompt = rawPrompt;
  }

  // ── 2. Generate image via Cloudflare Workers AI ─────────────────────────────
  let imageBuffer;
  try {
    imageBuffer = await generateImageWithRetry(generationPrompt);
  } catch (err) {
    console.error(`[Vision Agent] Image generation failed: ${err.message}`);

    let userMessage =
      "⚠️ The image generation service is currently unavailable. Please try again in a moment.";
    if (err.isPermanent && err.status === 401) {
      userMessage =
        "⚠️ Image generation authentication failed. Please verify Cloudflare API credentials.";
    } else if (err.status === 429) {
      userMessage =
        "⚠️ Image generation rate limit reached. Please wait a moment and try again.";
    } else if (err.status === 400 || (err.isPermanent && err.status === 400)) {
      userMessage = `⚠️ Image generation request was rejected: ${err.message}`;
    }

    return {
      ...state,
      aiResponse: userMessage,
      images: state?.images || [],
    };
  }

  // ── 3. Upload to Cloudinary ──────────────────────────────────────────────────
  let imageUrl;
  try {
    imageUrl = await uploadToCloudinary(imageBuffer);
  } catch (err) {
    console.error(`[Vision Agent] Cloudinary upload failed: ${err.message}`);
    return {
      ...state,
      aiResponse:
        "⚠️ The image was generated successfully but could not be saved to storage. Please try again.",
      images: state?.images || [],
    };
  }

  // ── 4. Return updated state ──────────────────────────────────────────────────
  return {
    ...state,
    aiResponse:
      "✅ Here is your generated image! I used Cloudflare Workers AI (FLUX.1 Schnell) to create it based on your request.",
    images: [...(Array.isArray(state?.images) ? state.images : []), imageUrl],
  };
};
