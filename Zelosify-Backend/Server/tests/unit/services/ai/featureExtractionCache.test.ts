import { describe, it, expect, vi, beforeEach } from "vitest";
import Groq from "groq-sdk";

import {
  FeatureExtractionTool,
  JobRequirements,
} from "../../../../src/services/ai/tools/FeatureExtractionTool.js";
import {
  JobRequirementsCache,
  JobRequirementsCacheKeyInput,
  buildJobRequirementsCacheKey,
} from "../../../../src/services/ai/cache/JobRequirementsCache.js";

vi.mock("groq-sdk");

class FakeJobRequirementsCache implements JobRequirementsCache {
  public readonly store = new Map<string, unknown>();
  public getCalls: string[] = [];
  public setCalls: Array<{ key: string; value: unknown }> = [];

  buildKey(input: JobRequirementsCacheKeyInput): string {
    return buildJobRequirementsCacheKey(input);
  }

  async get(key: string): Promise<unknown | null> {
    this.getCalls.push(key);
    return this.store.has(key) ? this.store.get(key) : null;
  }

  async set(key: string, value: unknown): Promise<void> {
    this.setCalls.push({ key, value });
    this.store.set(key, value);
  }

  isEnabled(): boolean {
    return true;
  }
}

const JOB_REQUIREMENTS: JobRequirements = {
  requiredSkills: ["Node.js", "PostgreSQL"],
  keywords: ["backend", "api"],
};

const successResponse = (payload: unknown) => ({
  choices: [{ message: { role: "assistant", content: JSON.stringify(payload) } }],
  usage: {
    prompt_tokens: 10,
    completion_tokens: 5,
    total_tokens: 15,
  },
});

describe("FeatureExtractionTool - job requirements cache", () => {
  const createMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    (Groq as any).mockImplementation(() => ({
      chat: {
        completions: {
          create: createMock,
        },
      },
    }));
  });

  it("returns cached requirements without calling Groq on a cache hit", async () => {
    const cache = new FakeJobRequirementsCache();
    const input = {
      openingTitle: "Backend Engineer",
      openingDescription: "Node.js and PostgreSQL",
    };

    cache.store.set(
      cache.buildKey(input),
      JOB_REQUIREMENTS,
    );

    const tool = new FeatureExtractionTool(cache);
    const result = await tool.extractFeatures(input);

    expect(createMock).not.toHaveBeenCalled();
    expect(result.cached).toBe(true);
    expect(result.attempts).toBe(0);
    expect(result.usage.totalTokens).toBe(0);
    expect(result.requirements).toEqual(JOB_REQUIREMENTS);
  });

  it("calls Groq once and populates the cache on a cache miss", async () => {
    const cache = new FakeJobRequirementsCache();
    const input = {
      openingTitle: "Backend Engineer",
      openingDescription: "Node.js and PostgreSQL",
    };

    createMock.mockResolvedValueOnce(
      successResponse(JOB_REQUIREMENTS),
    );

    const tool = new FeatureExtractionTool(cache);
    const result = await tool.extractFeatures(input);

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(result.cached).toBe(false);
    expect(result.requirements).toEqual(JOB_REQUIREMENTS);
    expect(cache.setCalls).toHaveLength(1);
    expect(cache.setCalls[0].key).toBe(cache.buildKey(input));
    expect(cache.setCalls[0].value).toEqual(JOB_REQUIREMENTS);
  });

  it("reuses the cached result for a second candidate on the same opening", async () => {
    const cache = new FakeJobRequirementsCache();
    const input = {
      openingTitle: "Backend Engineer",
      openingDescription: "Node.js and PostgreSQL",
    };

    createMock.mockResolvedValueOnce(
      successResponse(JOB_REQUIREMENTS),
    );

    const tool = new FeatureExtractionTool(cache);

    const first = await tool.extractFeatures(input);
    const second = await tool.extractFeatures(input);

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.requirements).toEqual(JOB_REQUIREMENTS);
  });

  it("ignores an invalid cached payload and falls back to Groq", async () => {
    const cache = new FakeJobRequirementsCache();
    const input = {
      openingTitle: "Backend Engineer",
      openingDescription: "Node.js and PostgreSQL",
    };

    cache.store.set(cache.buildKey(input), {
      requiredSkills: "not-an-array",
    });

    createMock.mockResolvedValueOnce(
      successResponse(JOB_REQUIREMENTS),
    );

    const tool = new FeatureExtractionTool(cache);
    const result = await tool.extractFeatures(input);

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(result.cached).toBe(false);
    expect(result.requirements).toEqual(JOB_REQUIREMENTS);
  });
});

describe("buildJobRequirementsCacheKey", () => {
  it("is deterministic and whitespace-insensitive", () => {
    const a = buildJobRequirementsCacheKey({
      openingTitle: "Backend   Engineer",
      openingDescription: "Node.js\nand PostgreSQL",
    });

    const b = buildJobRequirementsCacheKey({
      openingTitle: " Backend Engineer ",
      openingDescription: "Node.js and   PostgreSQL",
    });

    expect(a).toBe(b);
  });

  it("changes when the opening description changes", () => {
    const a = buildJobRequirementsCacheKey({
      openingTitle: "Backend Engineer",
      openingDescription: "Node.js and PostgreSQL",
    });

    const b = buildJobRequirementsCacheKey({
      openingTitle: "Backend Engineer",
      openingDescription: "Node.js, PostgreSQL and Redis",
    });

    expect(a).not.toBe(b);
  });
});