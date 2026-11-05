import fs from "fs";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getModel } from "../config/llmModels.js";
import { extractTokenUsage } from "../utils/extractTokens.js";

/**
 * Image Analyzer Agent
 * Reads the uploaded image from temp file path, converts to base64,
 * and sends a multimodal prompt to the Gemini model.
 */
export const imageAnalyzerAgent = async (state) => {
  console.log("[Image Analyzer Agent] Invoked");

  if (!state.file || !state.file.path) {
    console.warn("[Image Analyzer Agent] No file attached in state");
    return {
      ...state,
      aiResponse: "No image file was received. Please attach an image to analyze.",
    };
  }

  // 1. Read the uploaded image from its temporary file path using Node.js fs
  const imageBuffer = await fs.promises.readFile(state.file.path);

  // 2. Convert the image buffer to Base64
  const base64Image = imageBuffer.toString("base64");
  const mimeType = state.file.mimetype || "image/jpeg";

  // 3. Obtain the Gemini multimodal model from the model factory
  const llm = await getModel("imageAnalyzer");

  // 4. System prompt instructing model to analyze only the uploaded image,
  // answer accurately, extract visible text and explain charts/tables where possible
  const systemPrompt = `You are an expert AI image analyzer.
Your task is to analyze only the uploaded image provided by the user.
Answer the user's questions accurately, thoroughly, and factually based on the visual contents.
If the image contains text, extract the visible text accurately.
If the image contains charts, tables, diagrams, or graphs, explain their structure, data points, trends, and key insights clearly.
Do not hallucinate details that are not visible in the image.`;

  const userPrompt =
    state.prompt && state.prompt.trim()
      ? state.prompt.trim()
      : "Please analyze this image and explain what you see in detail.";

  // 5. Send a multimodal HumanMessage containing:
  //    - User's text prompt
  //    - Image data with its correct MIME type
  const humanMessage = new HumanMessage({
    content: [
      {
        type: "text",
        text: userPrompt,
      },
      {
        type: "image_url",
        image_url: {
          url: `data:${mimeType};base64,${base64Image}`,
        },
      },
    ],
  });

  const messages = [new SystemMessage(systemPrompt), humanMessage];

  // 6. Invoke model with graceful fallback across available Gemini models
  let response;
  let activeModel = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

  try {
    response = await llm.invoke(messages);
  } catch (err) {
    console.warn(
      `[Image Analyzer Agent] Primary model invocation failed: ${err.message}. Attempting fallbacks...`
    );

    const fallbackModels = [
      "gemini-3.1-flash-lite",
      "gemini-3.8-flash",
      "gemini-flash-latest",
    ];

    const { ChatGoogleGenerativeAI } = await import("@langchain/google-genai");
    let succeeded = false;

    for (const fallbackModel of fallbackModels) {
      try {
        console.log(`[Image Analyzer Agent] Trying fallback model: ${fallbackModel}`);
        const fallbackLlm = new ChatGoogleGenerativeAI({
          model: fallbackModel,
        });
        response = await fallbackLlm.invoke(messages);
        activeModel = fallbackModel;
        succeeded = true;
        break;
      } catch (fallbackErr) {
        console.warn(
          `[Image Analyzer Agent] Fallback model ${fallbackModel} failed: ${fallbackErr.message}`
        );
      }
    }

    if (!succeeded) {
      throw err;
    }
  }

  const modelName =
    response?.response_metadata?.model_name ||
    activeModel;
  const tokenUsage = extractTokenUsage(response, modelName);

  console.log("[Image Analyzer Agent] Image analysis completed successfully");

  // 7. Return generated text through existing LangGraph response flow
  return {
    ...state,
    aiResponse: response.content,
    ...(tokenUsage ? { usage: tokenUsage } : {}),
  };
};
