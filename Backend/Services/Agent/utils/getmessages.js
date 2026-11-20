import axios from "axios";

const CHAT_SERVICE_URL = process.env.CHAT_SERVICE_URL || "http://127.0.0.1:8002";

export const getmessages = async (conversationId) => {
  if (!conversationId || typeof conversationId !== "string" || conversationId.trim() === "") {
    throw new Error("conversationId is required to fetch messages");
  }

  try {
    const response = await axios.get(
      `${CHAT_SERVICE_URL}/chat/conversations/${conversationId.trim()}/messages`
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
