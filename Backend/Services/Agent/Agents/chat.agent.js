import { getModel } from "../config/llmModels.js";

export const chatAgent = async (state) => {
  const llm = await getModel("chat");

  const systemPrompt =
    "You are NexusMind AI, an intelligent AI assistant. Be helpful, clear, and concise.";

  // If a search agent ran first, incorporate its output into the user message
  const userContent = state.searchResult
    ? `Search results:\n${state.searchResult}\n\nUser question: ${state.prompt}`
    : state.prompt;

  const response = await llm.invoke([
    { role: "system", content: systemPrompt },
    { role: "human", content: userContent },
  ]);

  console.log("[Chat Agent] Response generated");

  return {
    ...state,
    aiResponse: response.content,
  };
};
