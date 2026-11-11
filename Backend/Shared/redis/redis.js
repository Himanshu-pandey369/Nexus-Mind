import Redis from "ioredis";

const redisUrl = process.env.Redis_URL || process.env.REDIS_URL || "redis://localhost:6379";

const redis = new Redis(redisUrl, {
  retryStrategy(times) {
    const delay = Math.min(times * 200, 2000);
    return delay;
  },
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
});

redis.on("connect", () => {
  console.log("Redis connected");
});

redis.on("error", (err) => {
  console.error("[Redis Error]", err.message);
});

export default redis;
