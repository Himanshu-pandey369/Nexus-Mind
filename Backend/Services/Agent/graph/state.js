import { Annotation } from "@langchain/langgraph";

export const agentState = Annotation.Root({
  prompt: Annotation(),
  conversationId: Annotation(),
  agent: Annotation(),
  aiResponse: Annotation(),
  history: Annotation(),
  searchResult: Annotation(),
  images: Annotation(),
  // artifacts: structured project files produced by the Coding Agent
  // [ { type: "code_generation", files: [{ name, content }, ...] } ]
  artifacts: Annotation(),
});
