import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenRouter } from "@langchain/openrouter";

// OpenRouter — primary model for chat, search summarisation, routing, PDF, PPT, Vision prompt enhancement
// "openai/gpt-oss-120b" is an OpenRouter model identifier; use ChatOpenRouter (not ChatGroq) for this model.
const groq = new ChatOpenRouter({
  model: "openai/gpt-oss-120b",
});

// Gemini multimodal model — used for image analysis
const geminiModel = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
const gemini = new ChatGoogleGenerativeAI({
  model: geminiModel,
});

const openrouter = new ChatOpenRouter({
  model: "deepseek/deepseek-chat",
  temperature:0,
  maxTokens:2500
});

export const getModel = async (agent) => {
  if (agent === "coding") return openrouter;
  if (agent === "imageAnalyzer") return gemini;
  if (agent === "pdfRag") return groq;
  // search, router, intent classification, and everything else → groq (fast & cheap)
  if (agent === "chat") return groq;
  if (agent === "vision") return groq; // prompt enhancement for image generation
  if (agent === "pdf") return groq;   // structured document content generation
  if (agent === "ppt") return groq;   // structured presentation content generation
  return groq; // "intent", "router", "search", default
};
