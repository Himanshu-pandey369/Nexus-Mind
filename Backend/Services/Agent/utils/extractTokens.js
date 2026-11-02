/**
 * Safely extracts actual token counts from LangChain AIMessage response metadata.
 * Does not fabricate token counts.
 *
 * @param {object} response - LangChain invoke response
 * @param {string} [fallbackModel] - Model name if not in metadata
 * @returns {{ model: string, inputTokens: number, outputTokens: number, totalTokens: number } | null}
 */
export function extractTokenUsage(response, fallbackModel = "") {
  if (!response) return null;

  const usage =
    response.usage_metadata ||
    response.response_metadata?.tokenUsage ||
    response.response_metadata?.usage ||
    response.additional_kwargs?.usage ||
    null;

  if (!usage) {
    return null;
  }

  const inputTokens =
    usage.input_tokens ??
    usage.promptTokens ??
    usage.prompt_tokens ??
    0;

  const outputTokens =
    usage.output_tokens ??
    usage.completionTokens ??
    usage.completion_tokens ??
    0;

  const totalTokens =
    usage.total_tokens ??
    usage.totalTokens ??
    inputTokens + outputTokens;

  const model =
    response.response_metadata?.model_name ||
    response.response_metadata?.model ||
    fallbackModel ||
    "";

  return {
    model,
    inputTokens: Number(inputTokens) || 0,
    outputTokens: Number(outputTokens) || 0,
    totalTokens: Number(totalTokens) || 0,
  };
}
