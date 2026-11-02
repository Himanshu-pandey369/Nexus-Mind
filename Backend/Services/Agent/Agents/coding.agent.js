import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getModel } from "../config/llmModels.js";
import { extractTokenUsage } from "../utils/extractTokens.js";

// ── Supported intents ──────────────────────────────────────────────────────────

const VALID_INTENTS = [
  "code_generation",
  "code_review",
  "code_explanation",
  "debugging",
  "optimization",
  "conversion",
  "documentation",
];

// ── Intent classification ──────────────────────────────────────────────────────

async function classifyIntent(prompt) {
  const llm = await getModel("intent"); // → Groq (fast, cheap)

  const classifierPrompt = `You are a coding task intent classifier.

Classify the user's request into exactly ONE of these intents:
- code_generation   : user wants new code, components, files, or an application/project generated
- debugging         : user wants help finding, diagnosing, or fixing a bug, error, or unexpected return value/behavior
- code_review       : user wants feedback, critique, or review of existing code
- code_explanation  : user wants an explanation of how valid code, syntax, concepts, or algorithms work
- optimization      : user wants code made faster, more efficient, smaller, or cleaner
- conversion        : user wants code translated from one programming language or format to another
- documentation     : user wants documentation, docstrings, comments, or a README generated

Rules:
- Return ONLY the intent label, nothing else.
- If the query mentions an error, bug, unexpected result (e.g. returns undefined), or fixing code, choose debugging.
- If unsure, return code_explanation.

User request: ${prompt}`;

  try {
    const response = await llm.invoke(classifierPrompt);
    const raw = String(response.content).trim().toLowerCase().replace(/[^a-z_]/g, "");
    const intent = VALID_INTENTS.find((i) => raw.includes(i)) ?? "code_explanation";
    console.log(`[Coding Agent] Intent classified: "${intent}" (raw: "${raw}")`);
    return intent;
  } catch (err) {
    console.warn(`[Coding Agent] Intent classification failed: ${err.message}. Defaulting to code_explanation.`);
    return "code_explanation";
  }
}

// ── JSON fence stripper (handle model wrapping in ```json ... ```) ─────────────

function extractJson(raw) {
  // Strip leading/trailing whitespace
  let text = raw.trim();
  // Remove ```json ... ``` or ``` ... ``` fences if present
  const fenceMatch = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }
  return text;
}

// ── Code generation ────────────────────────────────────────────────────────────

async function handleCodeGeneration(prompt) {
  const llm = await getModel("coding"); // → OpenRouter / DeepSeek

  const systemPrompt = `You are an expert software engineer and code generator.

Generate a complete, functional project based on the user's request.

CRITICAL: Respond with ONLY a valid JSON object — no markdown fences, no explanations, no text before or after.

The JSON must have exactly this structure:
{
  "files": [
    {
      "name": "filename.ext",
      "content": "full file content here"
    }
  ]
}

Rules:
- Include every file needed to run the project.
- Use meaningful file names with proper extensions.
- File names must be simple (no directory traversal like ../ or absolute paths).
- Generate complete, working code — not placeholders.
- Each file "content" must be a string (escape newlines as \\n if needed, but prefer actual newlines).
- Minimum 1 file, no arbitrary upper limit.`;

  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(`Generate project for: ${prompt}`),
  ];

  let raw;
  let usage = null;
  try {
    const response = await llm.invoke(messages);
    raw = String(response.content);
    usage = extractTokenUsage(response, "deepseek/deepseek-chat");
  } catch (err) {
    console.error(`[Coding Agent] Code generation LLM call failed: ${err.message}`);
    return {
      aiResponse: "Sorry, the code generation model failed to respond. Please try again.",
      artifacts: [],
    };
  }

  // Parse and validate JSON
  let parsed;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    console.error("[Coding Agent] Failed to parse code generation JSON. Raw output:\n", raw.slice(0, 500));
    return {
      aiResponse:
        "The AI generated a response but it was not valid JSON. Please rephrase your request or try again.",
      artifacts: [],
    };
  }

  // Validate structure
  if (!parsed || !Array.isArray(parsed.files) || parsed.files.length === 0) {
    console.error("[Coding Agent] JSON parsed but 'files' array is missing or empty.");
    return {
      aiResponse: "The AI did not produce any files. Please try a more specific request.",
      artifacts: [],
    };
  }

  // Validate each file entry; reject unsafe names
  const files = [];
  const UNSAFE_NAME = /[\/\\:*?"<>|]|^\./;
  for (const f of parsed.files) {
    if (
      f &&
      typeof f.name === "string" &&
      f.name.trim() &&
      !UNSAFE_NAME.test(f.name) &&
      typeof f.content === "string"
    ) {
      files.push({ name: f.name.trim(), content: f.content });
    } else {
      console.warn(`[Coding Agent] Skipping invalid file entry:`, JSON.stringify(f)?.slice(0, 100));
    }
  }

  if (files.length === 0) {
    return {
      aiResponse: "The AI produced only invalid file entries. Please try again.",
      artifacts: [],
    };
  }

  const fileList = files.map((f) => `• ${f.name}`).join("\n");
  return {
    aiResponse: `✅ Code generated successfully! Here are the files:\n${fileList}\n\nOpen the Artifact Panel to view and copy each file.`,
    artifacts: [{ type: "code_generation", files }],
    usage,
  };
}

// ── Non-generation coding intents ──────────────────────────────────────────────

async function handleGenericCodingIntent(intent, prompt) {
  const llm = await getModel("coding"); // DeepSeek for quality

  const intentInstructions = {
    code_review: `You are an expert code reviewer. Carefully review the code in the user's request.
Provide structured feedback with:
- A brief summary of what the code does
- Issues found (bugs, security problems, style violations)
- Specific improvement suggestions
- An overall quality assessment
Use Markdown with headings and code snippets where helpful.`,

    code_explanation: `You are an expert programming tutor. Explain the code or concept in the user's request clearly.
Cover:
- What it does and why
- How it works step by step
- Key concepts involved
- Common use cases or caveats
Use Markdown with headings, bullet points, and inline code examples where helpful.`,

    debugging: `You are an expert debugger. Analyze the code or error in the user's request.
Provide:
- Root cause of the bug
- Why the bug occurs
- Step-by-step fix with corrected code
- How to prevent similar bugs
Use Markdown with code blocks showing before/after.`,

    optimization: `You are a performance optimization expert. Analyze the code in the user's request.
Provide:
- What is inefficient and why
- Specific optimizations with explanations
- Optimized code
- Trade-offs if any
Use Markdown with code blocks and performance notes.`,

    conversion: `You are a polyglot programmer. Convert the code in the user's request as specified.
Provide:
- The converted code in the target language/format
- Notes on important differences
- Any caveats or limitations of the conversion
Use Markdown with properly fenced code blocks labeled with the language.`,

    documentation: `You are a technical writer. Generate documentation for the code or project in the user's request.
Include:
- Overview / purpose
- API / function signatures with parameter descriptions
- Usage examples
- Any important notes
Use proper Markdown with headings, tables where useful, and code examples.`,
  };

  const systemPrompt =
    intentInstructions[intent] ||
    "You are a helpful coding assistant. Respond with clear, well-formatted Markdown.";

  const messages = [
    new SystemMessage(systemPrompt),
    new HumanMessage(prompt),
  ];

  try {
    const response = await llm.invoke(messages);
    const usage = extractTokenUsage(response, "deepseek/deepseek-chat");
    return {
      aiResponse: String(response.content),
      artifacts: [],
      usage,
    };
  } catch (err) {
    console.error(`[Coding Agent] ${intent} LLM call failed: ${err.message}`);
    return {
      aiResponse: `The AI encountered an error while processing your ${intent.replace(/_/g, " ")} request. Please try again.`,
      artifacts: [],
    };
  }
}

// ── Main Coding Agent ──────────────────────────────────────────────────────────

export const codingAgent = async (state) => {
  console.log(`[Coding Agent] Processing prompt: "${state.prompt}"`);

  const intent = await classifyIntent(state.prompt);

  let result;
  if (intent === "code_generation") {
    result = await handleCodeGeneration(state.prompt);
  } else {
    result = await handleGenericCodingIntent(intent, state.prompt);
  }

  console.log(
    `[Coding Agent] Done. Intent: ${intent}, artifacts: ${result.artifacts.length}, response length: ${result.aiResponse.length}`
  );

  return {
    ...state,
    aiResponse: result.aiResponse,
    artifacts: result.artifacts,
    images: state.images || [],
    ...(result.usage ? { usage: result.usage } : {}),
  };
};
