import { tavily } from "@tavily/core";

const SEARCH_TIMEOUT_MS = 15000;

/**
 * Executes a Tavily search with a strict timeout.
 */
const executeSearchWithTimeout = async (client, query, options, timeoutMs = SEARCH_TIMEOUT_MS) => {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error("Search request timed out after 15 seconds"));
    }, timeoutMs);
  });

  try {
    return await Promise.race([client.search(query, options), timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Search Agent — retrieves live web results and images using Tavily.
 * Feeds structured search context and image URLs downstream to Chat Agent.
 */
export const searchAgent = async (state) => {
  console.log(`[Search Agent] Processing search query: "${state.prompt}"`);

  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey || apiKey.trim() === "") {
    console.warn("[Search Agent] TAVILY_API_KEY is not configured.");
    return {
      ...state,
      searchResult:
        "Web search is currently unavailable because the TAVILY_API_KEY environment variable is not configured on the server.",
      images: [],
    };
  }

  try {
    const client = tavily({ apiKey: apiKey.trim() });

    const response = await executeSearchWithTimeout(client, state.prompt, {
      includeImages: true,
      maxResults: 5,
    });

    // Format text results into structured context
    const parts = [];

    if (response.answer) {
      parts.push(`Direct Answer / Summary:\n${response.answer}`);
    }

    if (Array.isArray(response.results) && response.results.length > 0) {
      const sourceList = response.results
        .map(
          (r, idx) =>
            `[Source ${idx + 1}] ${r.title || "Untitled"}\nURL: ${r.url || "N/A"}\nSnippet: ${r.content || "No snippet available."}`
        )
        .join("\n\n");
      parts.push(`Search Results:\n${sourceList}`);
    }

    const searchResult =
      parts.length > 0
        ? parts.join("\n\n")
        : "No web search results were found for this query.";

    // Extract and sanitize image URLs
    const rawImages = Array.isArray(response.images) ? response.images : [];
    const images = [];

    for (const item of rawImages) {
      let url = null;
      if (typeof item === "string") {
        url = item;
      } else if (item && typeof item.url === "string") {
        url = item.url;
      }

      if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
        if (!images.includes(url)) {
          images.push(url);
        }
      }
      if (images.length >= 6) break;
    }

    console.log(
      `[Search Agent] Successfully retrieved ${response.results?.length || 0} results and ${images.length} images.`
    );

    return {
      ...state,
      searchResult,
      images,
    };
  } catch (error) {
    const errorMsg = error?.message || "Unknown error";
    console.error(`[Search Agent] Search execution failed: ${errorMsg}`);

    return {
      ...state,
      searchResult: `Web search could not be completed due to an error: ${errorMsg}.`,
      images: [],
    };
  }
};
