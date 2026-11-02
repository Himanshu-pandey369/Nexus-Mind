import express from "express";
import { agentChat, downloadPDF, downloadPPT } from "../controller/agent.controller.js";

const router = express.Router();

// POST /agent/chat
router.post("/chat", agentChat);

// GET /agent/pdf/download
router.get("/pdf/download", downloadPDF);

// GET /agent/ppt/download
router.get("/ppt/download", downloadPPT);

export default router;
