import axios from "axios";
import { getInternalServiceHeaders } from "../../../Shared/middleware/serviceAuth.js";

const normalizeUrl = (url, fallback) => {
  const target = (url || "").trim();
  if (!target && process.env.NODE_ENV === "production") {
    throw new Error("CHAT_SERVICE_URL must be configured in production");
  }
  const resolved = target || fallback || "";
  const withProtocol = /^https?:\/\//i.test(resolved)
    ? resolved
    : `${process.env.NODE_ENV === "production" ? "https" : "http"}://${resolved}`;
  return withProtocol.replace(/\/+$/, "");
};

const CHAT_SERVICE_URL = normalizeUrl(process.env.CHAT_SERVICE_URL, "http://127.0.0.1:8002");

export const getmessages = async (conversationId) => {
  if (!conversationId || typeof conversationId !== "string" || conversationId.trim() === "") {
    throw new Error("conversationId is required to fetch messages");
  }

  try {
    const response = await axios.get(
      `${CHAT_SERVICE_URL}/chat/conversations/${conversationId.trim()}/messages`,
      { headers: getInternalServiceHeaders() }
    );

    if (response.data && Array.isArray(response.data.messages)) {
      return response.data.messages;
    }

    throw new Error("Invalid response format received from Chat Service");
  } catch (error) {
    const msg = error.response?.data?.message || error.message;
    console.error(`[Chat Service] Failed to get messages for ${conversationId}:`, msg);
    throw error;
  }
};
