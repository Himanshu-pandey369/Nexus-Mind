import { warnMissingIntegrationConfig } from "../../../Shared/utils/startupWarnings.js";

export const AGENT_INTEGRATIONS = [
  {
    integration: "OpenRouter LLM",
    requiredVars: ["OPENROUTER_API_KEY"],
  },
  {
    integration: "Google AI (Gemini / Embeddings)",
    requiredVars: ["GOOGLE_API_KEY"],
  },
  {
    integration: "Qdrant Vector Store",
    requiredVars: ["QDRANT_URL", "QDRANT_API_KEY"],
  },
];

export function warnAgentStartupConfig(options) {
  warnMissingIntegrationConfig("Agent", AGENT_INTEGRATIONS, options);
}
