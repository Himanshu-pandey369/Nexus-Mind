import Redis from "ioredis";

// Standardize on REDIS_URL, falling back to legacy Redis_URL or local default
const redisUrl = process.env.REDIS_URL || process.env.Redis_URL || "redis://localhost:6379";

const redis = new Redis(redisUrl, {
  retryStrategy(times) {
    const delay = Math.min(times * 200, 2000);
    return delay;
  },
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

redis.on("connect", () => {
  console.log("Redis connected successfully");
});

redis.on("error", (err) => {
  console.error("[Redis Error]", err.message);
});

export default redis;
