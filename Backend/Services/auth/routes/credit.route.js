import express from "express";
import {
  getBalance,
  getHistory,
  reserveCredits,
  commitCredits,
  refundCredits,
} from "../controllers/credit.controller.js";

const router = express.Router();

// User-facing endpoints (authorized via Gateway x-user-id header)
router.get("/balance", getBalance);
router.get("/history", getHistory);

// Internal service-to-service endpoints
router.post("/reserve", reserveCredits);
router.post("/commit", commitCredits);
router.post("/refund", refundCredits);

export default router;
