import redis from "../../Shared/redis/redis.js";

const REDIS_UNAVAILABLE_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EPIPE",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "NR_CLOSED",
]);

const REDIS_UNAVAILABLE_MESSAGE_RE =
  /timed out|timeout|connection is closed|connection.*closed|not connected|isn't writeable|enableOfflineQueue|ECONNREFUSED|ECONNRESET|ETIMEDOUT/i;

const isRedisUnavailableError = (error, redisClient) => {
  if (!error) return false;
  if (REDIS_UNAVAILABLE_CODES.has(error.code)) return true;
  if (error.name === "MaxRetriesPerRequestError") return true;
  if (typeof error.message === "string" && REDIS_UNAVAILABLE_MESSAGE_RE.test(error.message)) {
    return true;
  }
  return redisClient?.status !== undefined && redisClient.status !== "ready";
};

const sendServiceUnavailable = (res) =>
  res.status(503).json({
    success: false,
    message: "Authentication service temporarily unavailable. Please try again later.",
  });

export const createAuthMiddleware = (redisClient = redis) => async (req, res, next) => {
  try {
    const sessionID = req.cookies?.session;

    if (!sessionID) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Please log in",
      });
    }

    if (redisClient.status !== "ready") {
      console.warn(`[Gateway Auth] Redis unavailable (status: ${redisClient.status})`);
      return sendServiceUnavailable(res);
    }

    let sessionData;
    try {
      sessionData = await redisClient.get(`session-${sessionID}`);
    } catch (redisError) {
      if (isRedisUnavailableError(redisError, redisClient)) {
        console.error(
          "[Gateway Auth] Redis unavailable during session lookup:",
          redisError.code || redisError.message
        );
        return sendServiceUnavailable(res);
      }
      throw redisError;
    }

    if (!sessionData) {
      return res.status(401).json({
        success: false,
        message: "Session expired or invalid",
      });
    }

    req.user = JSON.parse(sessionData);

    next();
  } catch (error) {
    console.error("Gateway authentication error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const authMiddleware = createAuthMiddleware();
