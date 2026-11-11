import { createRateLimiter } from "../../Shared/middleware/rateLimiter.js";

/**
 * General API rate limiter applied globally across all incoming Gateway requests.
 * Protects the gateway from general volume spikes, automated crawlers, and basic flooding.
 * Configurable via RATE_LIMIT_GENERAL_WINDOW_MS and RATE_LIMIT_GENERAL_MAX.
 */
export const generalLimiter = createRateLimiter({
  namespace: "general",
  windowMs: Number(process.env.RATE_LIMIT_GENERAL_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: Number(process.env.RATE_LIMIT_GENERAL_MAX) || 300, // 300 requests per 15 min
  keyType: "auto",
  message: "Too many requests to NexusMind API, please try again later.",
});

/**
 * Authentication rate limiter for login and registration endpoints (/auth).
 * Strictly IP-based to prevent credential brute-forcing and token verification flooding.
 * Configurable via RATE_LIMIT_AUTH_WINDOW_MS and RATE_LIMIT_AUTH_MAX.
 */
export const authLimiter = createRateLimiter({
  namespace: "auth",
  windowMs: Number(process.env.RATE_LIMIT_AUTH_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: Number(process.env.RATE_LIMIT_AUTH_MAX) || 30, // 30 requests per 15 min per IP
  keyType: "ip",
  message: "Too many authentication attempts from this IP, please try again later.",
});

/**
 * AI Agent & Chat rate limiter for prompt generation and chat persistence (/chat, /agent/chat).
 * Enforced on authenticated user ID (req.user.userID) so multiple users on the same NAT/IP
 * are not penalized, and malicious users cannot bypass by changing IP.
 * Configurable via RATE_LIMIT_AI_WINDOW_MS and RATE_LIMIT_AI_MAX.
 */
export const aiChatLimiter = createRateLimiter({
  namespace: "ai",
  windowMs: Number(process.env.RATE_LIMIT_AI_WINDOW_MS) || 60 * 1000, // 1 minute
  max: Number(process.env.RATE_LIMIT_AI_MAX) || 30, // 30 requests per minute per user
  keyType: "user",
  message: "Too many AI agent requests. Please slow down and try again shortly.",
});

/**
 * File & PDF Upload rate limiter for multimodal document and image analysis.
 * Stricter user-based limits to prevent disk exhaustion, heavy memory consumption, and LLM token spikes.
 * Configurable via RATE_LIMIT_UPLOAD_WINDOW_MS and RATE_LIMIT_UPLOAD_MAX.
 */
export const fileUploadLimiter = createRateLimiter({
  namespace: "upload",
  windowMs: Number(process.env.RATE_LIMIT_UPLOAD_WINDOW_MS) || 60 * 1000, // 1 minute
  max: Number(process.env.RATE_LIMIT_UPLOAD_MAX) || 10, // 10 uploads per minute per user
  keyType: "user",
  message: "Too many file upload requests. Please wait before uploading more documents.",
});

/**
 * Payment operations rate limiter (/payment/create-order, /payment/verify, /payment/retry-fulfillment).
 * Enforced on authenticated user ID to prevent Razorpay order flooding and verification spam.
 * Configurable via RATE_LIMIT_PAYMENT_WINDOW_MS and RATE_LIMIT_PAYMENT_MAX.
 */
export const paymentLimiter = createRateLimiter({
  namespace: "payment",
  windowMs: Number(process.env.RATE_LIMIT_PAYMENT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: Number(process.env.RATE_LIMIT_PAYMENT_MAX) || 30, // 30 payment operations per 15 min per user
  keyType: "user",
  message: "Too many payment operations. Please wait before attempting another transaction.",
});

/**
 * Smart dispatcher for /agent requests:
 * - If request has multipart/form-data (file/pdf upload), applies fileUploadLimiter.
 * - If request is standard prompt (/chat), applies aiChatLimiter.
 * - If request is download (/pdf/download or /ppt/download), delegates directly to proxy without
 *   consuming AI generation quota.
 */
export const agentRateLimitMiddleware = (req, res, next) => {
  const urlPath = req.url || req.path || "";
  const isChatRoute = urlPath.startsWith("/chat") || req.path === "/chat";

  if (isChatRoute) {
    const contentType = req.headers["content-type"] || "";
    if (contentType.includes("multipart/form-data")) {
      return fileUploadLimiter(req, res, next);
    }
    return aiChatLimiter(req, res, next);
  }

  // Non-chat routes (like /pdf/download or /ppt/download) bypass AI generation limiters
  return next();
};
