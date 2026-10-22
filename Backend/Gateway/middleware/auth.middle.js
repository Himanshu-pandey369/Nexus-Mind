import redis from "../../Shared/redis/redis.js";

export const authMiddleware = async (req, res, next) => {
  try {
    const sessionID = req.cookies?.session;

    if (!sessionID) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Please log in",
      });
    }

    const sessionData = await redis.get(`session-${sessionID}`);

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
