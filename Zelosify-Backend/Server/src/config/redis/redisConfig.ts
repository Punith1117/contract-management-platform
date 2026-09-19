import dotenv from "dotenv";

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

/**
 * Parses Redis URL into connection options for BullMQ / ioredis
 */
export const parseRedisUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || "localhost",
      port: parsed.port ? parseInt(parsed.port, 10) : 6379,
      password: parsed.password || undefined,
      username: parsed.username || undefined,
      tls: parsed.protocol === "rediss:" ? {} : undefined,
    };
  } catch {
    return { host: "localhost", port: 6379 };
  }
};

/**
 * Shared Redis connection options. Importing this module has no side
 * effects (no client is created), unlike the BullMQ queue module.
 */
export const redisConnectionOptions = parseRedisUrl(REDIS_URL);