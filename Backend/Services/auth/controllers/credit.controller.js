import * as creditService from "../services/creditService.js";
import UsageRecord from "../models/usageRecord.model.js";
import mongoose from "mongoose";

// Helper to verify internal service calls
const verifyInternalSecret = (req) => {
  const secret = process.env.INTERNAL_SECRET;
  if (!secret) return true; // Development mode fallback if unset
  return req.headers["x-internal-secret"] === secret;
};

/**
 * GET /auth/credits/balance
 * Returns the current authenticated user's credit balance.
 */
export const getBalance = async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Missing user identification",
      });
    }

    const balance = await creditService.getCreditBalance(userId);
    res.set("Cache-Control", "no-store");
    return res.status(200).json({
      success: true,
      balance,
    });
  } catch (err) {
    console.error("[Credit Controller] getBalance error:", err.message);
    const status = err.message === "User not found" ? 404 : 500;
    return res.status(status).json({
      success: false,
      message: err.message || "Failed to fetch credit balance",
    });
  }
};

/**
 * GET /auth/credits/history
 * Query params: page, limit
 */
export const getHistory = async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Missing user identification",
      });
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;

    const result = await creditService.getCreditTransactions(userId, {
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error("[Credit Controller] getHistory error:", err.message);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch credit transaction history",
    });
  }
};

/**
 * POST /auth/credits/reserve
 * Internal endpoint called by Agent Service before execution.
 * Body: { userId, amount, description }
 */
export const reserveCredits = async (req, res) => {
  try {
    if (!verifyInternalSecret(req)) {
      console.warn("[Credit Controller] reserveCredits: Invalid internal secret");
      return res.status(403).json({
        success: false,
        message: "Forbidden: Invalid internal secret",
      });
    }

    const { userId, amount, description } = req.body;
    if (!userId || amount === undefined) {
      return res.status(400).json({
        success: false,
        message: "userId and amount are required",
      });
    }

    console.log(
      `[Credit Controller] reserveCredits: userId=${userId}, amount=${amount}`
    );

    const result = await creditService.reserveCredits(
      userId,
      amount,
      description
    );

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error("[Credit Controller] reserveCredits error:", err.message);
    if (err.message === "Insufficient credits") {
      return res.status(402).json({
        success: false,
        message: "Insufficient credits",
        required: req.body?.amount,
      });
    }
    const status = err.message === "User not found" ? 404 : 500;
    return res.status(status).json({
      success: false,
      message: err.message || "Failed to reserve credits",
    });
  }
};

/**
 * POST /auth/credits/commit
 * Internal endpoint called by Agent Service after successful execution.
 * Body: { reservationId, userId, actualAmount?, description? }
 */
export const commitCredits = async (req, res) => {
  try {
    if (!verifyInternalSecret(req)) {
      console.warn("[Credit Controller] commitCredits: Invalid internal secret");
      return res.status(403).json({
        success: false,
        message: "Forbidden: Invalid internal secret",
      });
    }

    const { reservationId, userId, actualAmount, description } = req.body;
    if (!reservationId || !userId) {
      return res.status(400).json({
        success: false,
        message: "reservationId and userId are required",
      });
    }

    console.log(
      `[Credit Controller] commitCredits: reservationId=${reservationId}, userId=${userId}, actualAmount=${actualAmount}`
    );

    const result = await creditService.commitCredits(
      reservationId,
      userId,
      actualAmount,
      description
    );

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error("[Credit Controller] commitCredits error:", err.message);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to commit reservation",
    });
  }
};

/**
 * POST /auth/credits/refund
 * Internal endpoint called by Agent Service after failed execution.
 * Body: { reservationId, userId, description? }
 */
export const refundCredits = async (req, res) => {
  try {
    if (!verifyInternalSecret(req)) {
      console.warn("[Credit Controller] refundCredits: Invalid internal secret");
      return res.status(403).json({
        success: false,
        message: "Forbidden: Invalid internal secret",
      });
    }

    const { reservationId, userId, description } = req.body;
    if (!reservationId || !userId) {
      return res.status(400).json({
        success: false,
        message: "reservationId and userId are required",
      });
    }

    console.log(
      `[Credit Controller] refundCredits: reservationId=${reservationId}, userId=${userId}`
    );

    const result = await creditService.refundCredits(
      reservationId,
      userId,
      description
    );

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error("[Credit Controller] refundCredits error:", err.message);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to refund reservation",
    });
  }
};

/**
 * POST /auth/credits/add
 * Internal endpoint called by Payment Service after successful Razorpay verification.
 * Body: { userId, amount, source, referenceId, description }
 * Idempotent via referenceId — duplicate calls with the same referenceId return existing result.
 */
export const addCredits = async (req, res) => {
  try {
    if (!verifyInternalSecret(req)) {
      console.warn("[Credit Controller] addCredits: Invalid internal secret");
      return res.status(403).json({
        success: false,
        message: "Forbidden: Invalid internal secret",
      });
    }

    const { userId, amount, source, referenceId, description } = req.body;
    if (!userId || amount === undefined) {
      return res.status(400).json({
        success: false,
        message: "userId and amount are required",
      });
    }

    console.log(
      `[Credit Controller] addCredits: userId=${userId}, amount=${amount}, source=${source || "PAYMENT"}, referenceId=${referenceId || ""}`
    );

    const result = await creditService.addCredits(
      userId,
      amount,
      source || "PAYMENT",
      referenceId || "",
      description || ""
    );

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (err) {
    console.error("[Credit Controller] addCredits error:", err.message);
    const status = err.message === "User not found" ? 404 : 500;
    return res.status(status).json({
      success: false,
      message: err.message || "Failed to add credits",
    });
  }
};

/**
 * POST /auth/usage/record
 * Internal endpoint called by Agent Service to record token usage.
 * Body: { userId, conversationId, agent, model, inputTokens, outputTokens, totalTokens, estimatedCost, currency }
 */
export const recordUsage = async (req, res) => {
  try {
    if (!verifyInternalSecret(req)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Invalid internal secret",
      });
    }

    const {
      userId,
      conversationId,
      agent,
      model,
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCost,
      currency,
    } = req.body;

    if (!userId || !agent) {
      return res.status(400).json({
        success: false,
        message: "userId and agent are required",
      });
    }

    const record = await UsageRecord.create({
      userId: new mongoose.Types.ObjectId(userId),
      conversationId: conversationId || "",
      agent,
      model: model || "",
      inputTokens: Number(inputTokens) || 0,
      outputTokens: Number(outputTokens) || 0,
      totalTokens: Number(totalTokens) || 0,
      estimatedCost: Number(estimatedCost) || 0,
      currency: currency || "USD",
    });

    return res.status(201).json({
      success: true,
      recordId: record._id,
    });
  } catch (err) {
    console.error("[Credit Controller] recordUsage error:", err.message);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to record usage",
    });
  }
};

/**
 * GET /auth/usage/history
 * Query params: page, limit
 */
export const getUsageHistory = async (req, res) => {
  try {
    const userId = req.headers["x-user-id"];
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Missing user identification",
      });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      UsageRecord.find({ userId: new mongoose.Types.ObjectId(userId) })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      UsageRecord.countDocuments({
        userId: new mongoose.Types.ObjectId(userId),
      }),
    ]);

    return res.status(200).json({
      success: true,
      records,
      total,
      page,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    console.error("[Credit Controller] getUsageHistory error:", err.message);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch usage history",
    });
  }
};
