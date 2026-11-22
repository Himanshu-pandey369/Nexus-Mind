import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import redis from "../redis/redis.js";

/**
 * Creates a distributed Redis-backed rate limiter middleware.
 *
 * @param {Object} options
 * @param {string} options.namespace - Redis key prefix identifier (e.g. "general", "auth", "ai")
 * @param {number} [options.windowMs] - Time frame for which requests are checked (milliseconds)
 * @param {number} [options.max] - Max number of connections during windowMs
 * @param {string} [options.keyType] - "user" (authenticated req.user), "ip" (client IP), or "auto"
 * @param {string} [options.message] - Custom error message for HTTP 429
 * @param {Function} [options.skip] - Optional custom skip condition
 * @returns {Function} Express rate limit middleware
 */
export function createRateLimiter(options = {}) {
  const {
    namespace = "general",
    windowMs = 15 * 60 * 1000,
    max = 100,
    keyType = "auto",
    message = "Too many requests. Please try again later.",
    skip: customSkip,
  } = options;

  // Prefix for Redis keys to ensure clean namespacing
  const prefix = `rl:${namespace}:`;

  const store = new RedisStore({
    sendCommand: async (command, ...args) => {
      // Fail fast if Redis is not in ready state so passOnStoreError can allow the request without latency
      if (redis.status !== "ready") {
        throw new Error(`Redis is unavailable (status: ${redis.status})`);
      }

      // Hard timeout safety net: rate limiting must never block an HTTP request for more than 1500ms
      let timeoutHandle;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error("Redis rate-limiter command timed out"));
        }, 1500);
      });

      try {
        return await Promise.race([redis.call(command, ...args), timeoutPromise]);
      } finally {
        clearTimeout(timeoutHandle);
      }
    },
    prefix,
  });

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true, // Return standard RateLimit-* headers
    legacyHeaders: false, // Disable deprecated X-RateLimit-* headers
    passOnStoreError: true, // Fail open if Redis is temporarily unreachable

    // Key generation: reliable user ID for authenticated routes, IP for unauthenticated routes
    keyGenerator: (req) => {
      if (keyType === "user") {
        const userId = req.user?.userID || req.user?.id || req.user?._id;
        if (userId) {
          return `user:${userId}`;
        }
      }

      if (keyType === "auto") {
        const userId = req.user?.userID || req.user?.id || req.user?._id;
        if (userId) {
          return `user:${userId}`;
        }
      }

      // IP fallback / unauthenticated
      const rawIp =
        req.ip ||
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.socket?.remoteAddress ||
        "127.0.0.1";
      return `ip:${ipKeyGenerator(rawIp)}`;
    },

    // Exclude preflight requests, health checks, and optional custom skip conditions
    skip: (req) => {
      if (req.method === "OPTIONS") return true;
      if (req.path === "/health" || req.path === "/favicon.ico") return true;
      if (typeof customSkip === "function") return customSkip(req);
      return false;
    },

    // Standardized HTTP 429 response format with Retry-After header
    handler: (req, res, next, opts) => {
      const retryAfterSec = Math.ceil(opts.windowMs / 1000);
      const existingRetry = res.getHeader("Retry-After");
      const retryAfter = existingRetry ? Number(existingRetry) : retryAfterSec;

      res.set("Retry-After", String(retryAfter));

      return res.status(opts.statusCode || 429).json({
        success: false,
        message:
          typeof opts.message === "object" && opts.message.message
            ? opts.message.message
            : typeof opts.message === "string"
            ? opts.message
            : "Too many requests. Please try again later.",
        retryAfter,
      });
    },

    store,
  });
}

export default createRateLimiter;
