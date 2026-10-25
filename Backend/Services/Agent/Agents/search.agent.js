/**
 * Search Agent — placeholder implementation.
 * Real web search (e.g. Tavily, SerpAPI) will be wired up in a future stage.
 * Stores a note in `searchResult` so the Chat Agent can generate a response.
 */
export const searchAgent = async (state) => {
  console.log("[Search Agent] (placeholder) — real web search not yet implemented");

  return {
    ...state,
    searchResult: `[Search placeholder] No live search configured yet. The user asked: "${state.prompt}"`,
  };
};
