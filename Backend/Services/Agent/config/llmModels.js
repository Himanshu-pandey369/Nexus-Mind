import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenRouter } from "@langchain/openrouter";

let groqInstance = null;
let geminiInstance = null;
let openrouterInstance = null;

const getGroqModel = () => {
  if (!groqInstance) {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error(
        "OPENROUTER_API_KEY is not defined. Please set it in your environment variables."
      );
    }
    groqInstance = new ChatOpenRouter({
      model: "openai/gpt-oss-120b",
      apiKey: process.env.OPENROUTER_API_KEY,
    });
  }
  return groqInstance;
};

const getGeminiModel = () => {
  if (!geminiInstance) {
    if (!process.env.GOOGLE_API_KEY) {
      throw new Error(
        "GOOGLE_API_KEY is not defined. Please set it in your environment variables."
      );
    }
    const geminiModel = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
    geminiInstance = new ChatGoogleGenerativeAI({
      model: geminiModel,
      apiKey: process.env.GOOGLE_API_KEY,
    });
  }
  return geminiInstance;
};

const getOpenrouterModel = () => {
  if (!openrouterInstance) {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error(
        "OPENROUTER_API_KEY is not defined. Please set it in your environment variables."
      );
    }
    openrouterInstance = new ChatOpenRouter({
      model: "deepseek/deepseek-chat",
      temperature: 0,
      maxTokens: 2500,
      apiKey: process.env.OPENROUTER_API_KEY,
    });
  }
  return openrouterInstance;
};

export const getModel = async (agent) => {
  if (agent === "coding") return getOpenrouterModel();
  if (agent === "imageAnalyzer") return getGeminiModel();
  if (agent === "pdfRag") return getGroqModel();
  // search, router, intent classification, and everything else → groq (fast & cheap)
  if (agent === "chat") return getGroqModel();
  if (agent === "vision") return getGroqModel(); // prompt enhancement for image generation
  if (agent === "pdf") return getGroqModel();   // structured document content generation
  if (agent === "ppt") return getGroqModel();   // structured presentation content generation
  return getGroqModel(); // "intent", "router", "search", default
};
