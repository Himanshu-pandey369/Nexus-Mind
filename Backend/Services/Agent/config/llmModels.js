import { ChatGroq } from "@langchain/groq";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenRouter } from "@langchain/openrouter";
// Groq — fast model used for chat, search summarisation, and routing
const groq = new ChatGroq({
  model: "openai/gpt-oss-120b",
});

// Gemini — used for coding tasks
const gemini = new ChatGoogleGenerativeAI({
  model: "gemini-3.8-flash",
});

const openrouter = new ChatOpenRouter({
  model: "deepseek/deepseek-chat",
  temperature:0,
  maxTokens:2500
});

export const getModel = async (agent) => {
  if (agent === "coding") return openrouter;
  // search, router, intent classification, and everything else → groq (fast & cheap)
  if (agent === "chat") return gemini;
  return groq; // "intent", "router", "search", default
};
