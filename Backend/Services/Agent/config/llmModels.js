import { ChatGroq } from "@langchain/groq";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

// Groq — fast model used for chat, search summarisation, and routing
const groq = new ChatGroq({
  model: "openai/gpt-oss-120b",
});

// Gemini — used for coding tasks
const gemini = new ChatGoogleGenerativeAI({
  model: "gemini-2.0-flash",
});

export const getModel = async (agent) => {
  if (agent === "coding") return gemini;
  // chat, search, router, and everything else → groq
  return groq;
};
