import express from "express";
import {
  recordUsage,
  getUsageHistory,
} from "../controllers/credit.controller.js";

const router = express.Router();

// Internal service-to-service endpoint
router.post("/record", recordUsage);

// User-facing endpoint (authorized via Gateway x-user-id header)
router.get("/history", getUsageHistory);

export default router;
