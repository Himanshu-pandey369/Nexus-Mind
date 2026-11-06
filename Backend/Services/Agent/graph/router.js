import { getModel } from "../config/llmModels.js";

const VALID_AGENTS = ["chat", "search", "coding", "pdf", "ppt", "vision", "imageAnalyzer", "pdfRag"];

export const router = async (state) => {
  // If an uploaded file is present, route based on file MIME type / extension
  if (state.file) {
    const mime = (state.file.mimetype || "").toLowerCase();
    const name = (state.file.originalname || "").toLowerCase();
    if (mime === "application/pdf" || name.endsWith(".pdf")) {
      console.log(`[Router] Uploaded PDF detected (${state.file.originalname || "document.pdf"}) → Agent: "pdfRag"`);
      return {
        ...state,
        agent: "pdfRag",
      };
    }

    console.log(`[Router] Uploaded image detected (${state.file.originalname || "image"}) → Agent: "imageAnalyzer"`);
    return {
      ...state,
      agent: "imageAnalyzer",
    };
  }

  if (state.agent && state.agent !== "auto") {
    const normalized = state.agent.trim();
    const matched = VALID_AGENTS.find((a) => a.toLowerCase() === normalized.toLowerCase());
    return {
      ...state,
      agent: matched || state.agent,
    };
  }
  const llm = await getModel("router");

  const routerPrompt = `
You are an intelligent agent router.

Your task is to select the most suitable agent for the user's request.

Available agents:
- chat
- search
- coding
- pdf
- ppt
- vision

Agent selection rules:

1. chat:
   - General conversation and greetings.
   - Explanations, learning, and conceptual questions.
   - General knowledge that does not require current information.
   - Questions asking to analyze, describe, or discuss an image when no image is uploaded.

2. search:
   - Requests for current or real-time information.
   - Web research, news, facts that need verification.
   - Finding information from online sources.

3. coding:
   - Writing, debugging, reviewing, or explaining code.
   - Programming problems, algorithms, and technical implementation.
   - Software architecture and development tasks.

4. pdf:
   - Requests to generate, create, write, or export PDF documents or reports on any topic.
   - Requests to read, summarize, analyze, or extract information from PDF documents.
   - Questions about an uploaded PDF.
   - Creating or modifying PDF documents.

5. ppt:
   - Requests to create, generate, or modify presentations.
   - Preparing slides, presentation outlines, or slide content.

6. vision:
   - Requests to generate, draw, or create images from text descriptions.
   - Creating illustrations, visual artwork, or image designs.
   - Strictly for generating NEW images. Never select vision for questions asking to analyze, examine, or explain an image.

Important rules:
- Return only one word from this exact list: chat, search, coding, pdf, ppt, vision
- Choose the agent that best matches the user's primary intent.
- Never answer the user's actual question.
- Do not explain your selection.

User Query:
${state.prompt}
`;

  const response = await llm.invoke(routerPrompt);
  const selected = response.content.trim().toLowerCase();

  const agent = VALID_AGENTS.includes(selected) ? selected : "chat";

  console.log(`[Router] Prompt: "${state.prompt}" → Agent: "${agent}"`);

  return {
    ...state,
    agent,
  };
};
