import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { getModel } from "../config/llmModels.js";
import { getMemory } from "../config/memory.js";
import { extractTokenUsage } from "../utils/extractTokens.js";

export const chatAgent = async (state) => {
  const llm = await getModel("chat");
  const history =
    state.history ||
    (state.conversationId ? await getMemory(state.conversationId) : []);

  const systemPrompt = state.searchResult
    ? "You are NexusMind AI, an intelligent AI assistant. Use the provided search results to answer the user's question accurately, concisely, and factually. If the search results state that web search failed or could not be completed, clearly inform the user of this fact and do not pretend to have accessed the live web."
    : "You are NexusMind AI, an intelligent AI assistant. Be helpful, clear, and concise.";

  const messages = [new SystemMessage(systemPrompt)];

  if (Array.isArray(history)) {
    history.forEach((msg) => {
      if (msg.role === "user") {
        messages.push(new HumanMessage(msg.content));
      } else if (msg.role === "assistant") {
        messages.push(new AIMessage(msg.content));
      }
    });
  }

  // If a search agent ran first, incorporate its output into the user message
  const userContent = state.searchResult
    ? `Search results:\n${state.searchResult}\n\nUser question: ${state.prompt}`
    : state.prompt;

  messages.push(new HumanMessage(userContent));

  const response = await llm.invoke(messages);
  const tokenUsage = extractTokenUsage(response, "openai/gpt-oss-120b");

  console.log("[Chat Agent] Response generated");

  return {
    ...state,
    aiResponse: response.content,
    images: state.images || [],
    ...(tokenUsage ? { usage: tokenUsage } : {}),
  };
};
