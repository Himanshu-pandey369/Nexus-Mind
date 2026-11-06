/**
 * Centralized agent credit pricing and model token pricing.
 * Keep payment processing independent from credit management.
 */

export const AGENT_PRICING = {
  chat: 1,
  search: 5,
  coding: 10,
  pdf: 10,
  ppt: 10,
  vision: 10,
  imageAnalyzer: 5,
  pdfRag: 5,
};

export const VALID_AGENTS = Object.keys(AGENT_PRICING);

/**
 * Returns credit cost for the given agent identifier.
 * Rejects unknown agents.
 * @param {string} agent
 * @returns {number}
 */
export function getAgentCost(agent) {
  if (!agent || typeof agent !== "string") {
    throw new Error(`Invalid agent identifier: ${agent}`);
  }

  const normalized = agent.trim().toLowerCase();
  const matchedKey = Object.keys(AGENT_PRICING).find(
    (key) => key.toLowerCase() === normalized
  );

  if (!matchedKey || AGENT_PRICING[matchedKey] === undefined) {
    throw new Error(
      `Unknown agent: "${normalized}". Valid agents: ${VALID_AGENTS.join(", ")}`
    );
  }

  return AGENT_PRICING[matchedKey];
}

/**
 * Configurable model token pricing per 1,000,000 tokens (USD).
 */
export const MODEL_TOKEN_PRICING = {
  "openai/gpt-oss-120b": {
    inputPerMillion: 0.15,
    outputPerMillion: 0.60,
  },
  "deepseek/deepseek-chat": {
    inputPerMillion: 0.14,
    outputPerMillion: 0.28,
  },
  "gemini-2.5-flash": {
    inputPerMillion: 0.10,
    outputPerMillion: 0.40,
  },
  "gemini-2.5": {
    inputPerMillion: 0.10,
    outputPerMillion: 0.40,
  },
  "gemini-3.8-flash": {
    inputPerMillion: 0.10,
    outputPerMillion: 0.40,
  },
  default: {
    inputPerMillion: 0.15,
    outputPerMillion: 0.60,
  },
};

/**
 * Calculate estimated USD cost based on token counts and model.
 * @param {string} model
 * @param {number} inputTokens
 * @param {number} outputTokens
 * @returns {number}
 */
export function estimateTokenCost(model, inputTokens = 0, outputTokens = 0) {
  const rates =
    MODEL_TOKEN_PRICING[model] || MODEL_TOKEN_PRICING.default;
  const inputCost = (inputTokens / 1_000_000) * rates.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * rates.outputPerMillion;
  return Number((inputCost + outputCost).toFixed(6));
}
