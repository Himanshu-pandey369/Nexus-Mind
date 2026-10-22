import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";

// POST /chat/conversations
export const createConversation = async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: user ID missing",
      });
    }

    const conversation = await Conversation.create({ userId });

    return res.status(201).json({
      success: true,
      conversation,
    });
  } catch (error) {
    console.error("Create conversation error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to create conversation",
    });
  }
};

// GET /chat/conversations
export const getConversations = async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: user ID missing",
      });
    }

    const conversations = await Conversation.find({ userId }).sort({
      updatedAt: -1,
    });

    return res.status(200).json({
      success: true,
      conversations,
    });
  } catch (error) {
    console.error("Get conversations error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch conversations",
    });
  }
};

// POST /chat/conversations/:conversationId/messages
export const saveMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { role, content } = req.body;

    if (!role || !content) {
      return res.status(400).json({
        success: false,
        message: "role and content are required",
      });
    }

    const message = await Message.create({ conversationId, role, content });

    return res.status(201).json({
      success: true,
      message,
    });
  } catch (error) {
    console.error("Save message error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to save message",
    });
  }
};

// GET /chat/conversations/:conversationId/messages
export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const messages = await Message.find({ conversationId }).sort({
      createdAt: 1,
    });

    return res.status(200).json({
      success: true,
      messages,
    });
  } catch (error) {
    console.error("Get messages error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch messages",
    });
  }
};

// PATCH /chat/conversations/:conversationId/title
export const updateConversationTitle = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: "title is required",
      });
    }

    const conversation = await Conversation.findByIdAndUpdate(
      conversationId,
      { title },
      { new: true }
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    return res.status(200).json({
      success: true,
      conversation,
    });
  } catch (error) {
    console.error("Update conversation title error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to update conversation title",
    });
  }
};
