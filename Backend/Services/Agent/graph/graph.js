import { StateGraph } from "@langchain/langgraph";
import { agentState } from "./state.js";
import { router } from "./router.js";
import { chatAgent } from "../Agents/chat.agent.js";
import { searchAgent } from "../Agents/search.agent.js";
import { codingAgent } from "../Agents/coding.agent.js";
import { pdfAgent } from "../Agents/pdf.agent.js";
import { pptAgent } from "../Agents/ppt.agent.js";
import { visionAgent } from "../Agents/vision.js";
import { imageAnalyzerAgent } from "../Agents/imageAnalyzer.agent.js";
import { pdfRagAgent } from "../Agents/pdfRag.agent.js";

const workflow = new StateGraph(agentState);

workflow.addNode("router", router);
workflow.addNode("chat", chatAgent);
workflow.addNode("search", searchAgent);
workflow.addNode("coding", codingAgent);
workflow.addNode("pdf", pdfAgent);
workflow.addNode("ppt", pptAgent);
workflow.addNode("vision", visionAgent);
workflow.addNode("imageAnalyzer", imageAnalyzerAgent);
workflow.addNode("pdfRag", pdfRagAgent);

// START → router
workflow.addEdge("__start__", "router");

// router → conditional dispatch
workflow.addConditionalEdges(
  "router",
  (state) => {
    const valid = ["chat", "search", "coding", "pdf", "ppt", "vision", "imageAnalyzer", "pdfRag"];
    return valid.includes(state.agent) ? state.agent : "chat";
  },
  {
    chat: "chat",
    search: "search",
    coding: "coding",
    pdf: "pdf",
    ppt: "ppt",
    vision: "vision",
    imageAnalyzer: "imageAnalyzer",
    pdfRag: "pdfRag",
  }
);

// search → chat (chat agent converts search results into a readable reply)
workflow.addEdge("search", "chat");

// All terminal agents → END
workflow.addEdge("chat", "__end__");
workflow.addEdge("coding", "__end__");
workflow.addEdge("pdf", "__end__");
workflow.addEdge("ppt", "__end__");
workflow.addEdge("vision", "__end__");
workflow.addEdge("imageAnalyzer", "__end__");
workflow.addEdge("pdfRag", "__end__");

export const graph = workflow.compile();
