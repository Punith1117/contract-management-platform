import crypto from "crypto";
import Redis from "ioredis";
import dotenv from "dotenv";

import { redisConnectionOptions } from "../../../config/redis/redisConfig.js";
import { AILogger } from "../utils/logger.js";

dotenv.config();

const CACHE_KEY_PREFIX = "jobreq:v1:";
const DEFAULT_TTL_SECONDS = 604800; // 7 days

export interface JobRequirementsCacheKeyInput {
  openingTitle: string;
  openingDescription?: string | null;
}

export interface JobRequirementsCache {
  buildKey(input: JobRequirementsCacheKeyInput): string;
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  isEnabled(): boolean;
}

const normalize = (value: string | null | undefined): string =>
  (value ?? "").replace(/\s+/g, " ").trim();

export const buildJobRequirementsCacheKey = (
  input: JobRequirementsCacheKeyInput,
): string => {
  const fingerprint = `${normalize(input.openingTitle)}\n${normalize(
    input.openingDescription,
  )}`;

  const hash = crypto
    .createHash("sha256")
    .update(fingerprint)
    .digest("hex");

  return `${CACHE_KEY_PREFIX}${hash}`;
};

export class RedisJobRequirementsCache
  implements JobRequirementsCache
{
  private client: Redis | null = null;

  isEnabled(): boolean {
    return (
      process.env.JOB_REQUIREMENTS_CACHE_ENABLED !==
      "false"
    );
  }

  private getTtlSeconds(): number {
    const parsed = Number.parseInt(
      process.env.JOB_REQUIREMENTS_CACHE_TTL_SECONDS ??
        "",
      10,
    );

    return Number.isFinite(parsed) && parsed > 0
      ? parsed
      : DEFAULT_TTL_SECONDS;
  }

  private getClient(): Redis {
    if (!this.client) {
      this.client = new Redis({
        ...redisConnectionOptions,
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
      });

      this.client.on("error", (error) => {
        AILogger.warn("cache_redis_error", {
          error: error?.message || String(error),
        });
      });
    }

    return this.client;
  }

  buildKey(input: JobRequirementsCacheKeyInput): string {
    return buildJobRequirementsCacheKey(input);
  }

  async get(key: string): Promise<unknown | null> {
    if (!this.isEnabled()) {
      return null;
    }

    try {
      const raw = await this.getClient().get(key);

      if (!raw) {
        return null;
      }

      return JSON.parse(raw);
    } catch (error: any) {
      AILogger.warn("cache_get_failed", {
        error: error?.message || String(error),
      });

      return null;
    }
  }

  async set(
    key: string,
    value: unknown,
    ttlSeconds?: number,
  ): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }

    try {
      await this.getClient().set(
        key,
        JSON.stringify(value),
        "EX",
        ttlSeconds ?? this.getTtlSeconds(),
      );
    } catch (error: any) {
      AILogger.warn("cache_set_failed", {
        error: error?.message || String(error),
      });
    }
  }
}

export const jobRequirementsCache =
  new RedisJobRequirementsCache();