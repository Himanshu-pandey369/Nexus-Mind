import express from "express";
import {
  getPackages,
  createOrder,
  verifyPayment,
  getPaymentHistory,
  retryFulfillment,
  handleWebhook,
} from "../controllers/payment.controller.js";

const router = express.Router();

// Public: Get available credit packages
router.get("/packages", getPackages);

// Public / Server-to-server: Razorpay Webhook endpoint (verified via HMAC signature)
router.post("/webhook", handleWebhook);

// Authenticated: Create Razorpay order
router.post("/create-order", createOrder);

// Authenticated: Verify payment and fulfill credits
router.post("/verify", verifyPayment);

// Authenticated: Get user's payment history
router.get("/history", getPaymentHistory);

// Authenticated: Retry failed credit fulfillment
router.post("/retry-fulfillment", retryFulfillment);

export default router;
