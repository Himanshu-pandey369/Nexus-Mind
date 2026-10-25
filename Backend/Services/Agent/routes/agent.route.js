import express from "express";
import { agentChat } from "../controller/agent.controller.js";

const router = express.Router();

// POST /agent/chat
router.post("/chat", agentChat);

export default router;
