import { Annotation } from "@langchain/langgraph";

export const agentState = Annotation.Root({
  prompt: Annotation(),
  conversationId: Annotation(),
  agent: Annotation(),
  aiResponse: Annotation(),
  history: Annotation(),
  searchResult: Annotation(),
});
