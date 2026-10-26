import redis from "../../../Shared/redis/redis.js";
import { getmessages } from "../utils/getmessages.js";

const TTL_SECONDS = 24 * 60 * 60; // 24 hours
const MAX_HISTORY_LENGTH = 20;

/**
 * Retrieve conversation history from Redis cache, or fall back to Chat Service.
 * Scoped strictly per conversationId.
 */
export const getMemory = async (conversationId) => {
  if (!conversationId || typeof conversationId !== "string" || conversationId.trim() === "") {
    throw new Error("conversationId is required to retrieve memory");
  }

  const key = `messages-${conversationId.trim()}`;

  // 1. Try Redis cache
  try {
    const cached = await redis.get(key);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn(`[Memory] Redis get error for ${key}:`, err.message);
  }

  // 2. Cache miss or Redis unavailable: fetch from Chat Service
  const messages = await getmessages(conversationId.trim());

  if (Array.isArray(messages)) {
    // 3. Populate Redis cache with TTL
    try {
      await redis.set(key, JSON.stringify(messages), "EX", TTL_SECONDS);
    } catch (err) {
      console.warn(`[Memory] Redis set error for ${key}:`, err.message);
    }
    return messages;
  }

  throw new Error(`Failed to retrieve messages for conversation: ${conversationId}`);
};

/**
 * Append message(s) to conversation memory in Redis with TTL.
 * Supports either (conversationId, role, content) or (conversationId, [ { role, content }, ... ]).
 */
export const addMemory = async (conversationId, roleOrMessages, content) => {
  if (!conversationId || typeof conversationId !== "string" || conversationId.trim() === "") {
    return;
  }

  const key = `messages-${conversationId.trim()}`;
  let messages = [];

  // Check existing cache, or initialize from Chat Service if cache missed
  try {
    const cached = await redis.get(key);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        messages = parsed;
      }
    } else {
      const fetched = await getmessages(conversationId.trim());
      if (Array.isArray(fetched)) {
        messages = fetched;
      }
    }
  } catch (err) {
    console.warn(`[Memory] Cache lookup error in addMemory:`, err.message);
  }

  // Normalize input into list of message objects
  const toAdd = Array.isArray(roleOrMessages)
    ? roleOrMessages
    : [{ role: roleOrMessages, content }];

  for (const item of toAdd) {
    if (!item || !item.role || !item.content) continue;
    const last = messages[messages.length - 1];
    if (!last || last.role !== item.role || last.content !== item.content) {
      messages.push({ role: item.role, content: item.content });
    }
  }

  // Keep sliding window of latest messages
  if (messages.length > MAX_HISTORY_LENGTH) {
    messages = messages.slice(-MAX_HISTORY_LENGTH);
  }

  try {
    await redis.set(key, JSON.stringify(messages), "EX", TTL_SECONDS);
  } catch (err) {
    console.warn(`[Memory] Redis set error in addMemory:`, err.message);
  }

  return messages;
};
