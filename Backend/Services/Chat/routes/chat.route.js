import express from "express";
import {
  createConversation,
  getConversations,
  saveMessage,
  getMessages,
  updateConversationTitle,
} from "../controllers/chat.controller.js";

const router = express.Router();

router.post("/conversations", createConversation);
router.get("/conversations", getConversations);
router.post("/conversations/:conversationId/messages", saveMessage);
router.get("/conversations/:conversationId/messages", getMessages);
router.patch("/conversations/:conversationId/title", updateConversationTitle);

export default router;
