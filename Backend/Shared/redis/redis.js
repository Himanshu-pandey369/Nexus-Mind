import Redis from "ioredis";

// Standardize on REDIS_URL, falling back to legacy Redis_URL or local default
const redisUrl = process.env.REDIS_URL || process.env.Redis_URL || "redis://localhost:6379";
const isTls = redisUrl.startsWith("rediss://");

const redis = new Redis(redisUrl, {
  retryStrategy(times) {
    // Exponential backoff capped at 2 seconds
    const delay = Math.min(times * 200, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3, // Bounded retries: allows commands to reject on failure so express-rate-limit can fail-open
  commandTimeout: 2000, // 2s command timeout ensures HTTP requests never hang indefinitely
  connectTimeout: 5000, // 5s connection timeout
  keepAlive: 15000, // 15s TCP keepalive prevents idle connection drops (ECONNRESET) on cloud platforms like Render
  enableReadyCheck: true,
  enableOfflineQueue: true,
  ...(isTls ? { tls: {} } : {}),
});

redis.on("connect", () => {
  console.log("Redis connected successfully");
});

redis.on("ready", () => {
  console.log("Redis ready to accept commands");
});

redis.on("reconnecting", (delay) => {
  console.warn(`[Redis Reconnecting] Reconnecting in ${delay}ms...`);
});

redis.on("error", (err) => {
  console.error("[Redis Error]", err.message);
});

export default redis;
