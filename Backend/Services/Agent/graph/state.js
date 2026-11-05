import { Annotation } from "@langchain/langgraph";

export const agentState = Annotation.Root({
  prompt: Annotation(),
  conversationId: Annotation(),
  agent: Annotation(),
  aiResponse: Annotation(),
  history: Annotation(),
  searchResult: Annotation(),
  images: Annotation(),
  // file: metadata & temp path of uploaded file for multimodal analysis
  file: Annotation(),
  // artifacts: structured project files produced by the Coding Agent
  // [ { type: "code_generation", files: [{ name, content }, ...] } ]
  artifacts: Annotation(),
  // usage: token usage metadata collected across agent invocations
  usage: Annotation({
    reducer: (existing, incoming) => {
      if (!incoming) return existing || null;
      if (!existing) return incoming;
      return {
        model: incoming.model || existing.model,
        inputTokens: (existing.inputTokens || 0) + (incoming.inputTokens || 0),
        outputTokens: (existing.outputTokens || 0) + (incoming.outputTokens || 0),
        totalTokens: (existing.totalTokens || 0) + (incoming.totalTokens || 0),
      };
    },
    default: () => null,
  }),
});
