import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgentOrchestrator } from "../../../../src/services/ai/agent/AgentOrchestrator.js";
import { ResumeParsingTool, StructuredResume } from "../../../../src/services/ai/tools/ResumeParsingTool.js";
import { FeatureExtractionTool } from "../../../../src/services/ai/tools/FeatureExtractionTool.js";
import { SkillNormalizationTool } from "../../../../src/services/ai/tools/SkillNormalizationTool.js";
import Groq from "groq-sdk";

vi.mock("groq-sdk");

describe("AgentOrchestrator - Tool Calling & Authoritative Deterministic Score Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should execute Groq tool calling WITHOUT response_format json_object and maintain single deterministic score path", async () => {
    const mockResumeText = `
      Sarah Williams
      Senior QA Automation Lead
      6 years experience in Cypress, Playwright, Python test automation.
      Worked on end-to-end testing, REST APIs, CI/CD pipelines.
    `;
    const mockStructuredResume: StructuredResume = {
      experience: [{ startYear: 2018, endYear: 2024 }],
      skills: ["Cypress", "Playwright", "Python"],
      location: "Remote",
      education: ["B.Tech Computer Science"],
      keywords: ["testing", "qa", "automation"],
    };

    vi.spyOn(ResumeParsingTool.prototype, "parseResumeFromS3").mockResolvedValue({
      resume: mockStructuredResume,
      metadata: {
        latencyMs: 120,
        characterCount: mockResumeText.length,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        attempts: 1,
      },
    });

    vi.spyOn(FeatureExtractionTool.prototype, "extractFeatures").mockResolvedValue({
      requirements: {
        requiredSkills: ["Cypress", "Playwright", "Python"],
        keywords: ["testing", "qa"],
      },
      latencyMs: 50,
      attempts: 1,
      cached: false,
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    });

    vi.spyOn(SkillNormalizationTool.prototype, "execute").mockResolvedValue({
      result: {
        normalizedCandidateSkills: ["Cypress", "Playwright", "Python"],
        normalizedRequiredSkills: ["Cypress", "Playwright", "Python"],
        matchedSkills: ["Cypress", "Playwright", "Python"],
        missingSkills: [],
      },
      latencyMs: 50,
      attempts: 1,
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    });

    const createMock = vi.fn();

    // Turn 1: parse_resume
    createMock.mockResolvedValueOnce({
      usage: { prompt_tokens: 150, completion_tokens: 30, total_tokens: 180 },
      choices: [
        {
          message: {
            role: "assistant",
            tool_calls: [
              {
                id: "call_1",
                function: { name: "parse_resume", arguments: JSON.stringify({ s3Key: "resumes/sarah.pdf" }) },
              },
            ],
          },
        },
      ],
    });

    // Turn 2: extract_features
    createMock.mockResolvedValueOnce({
      usage: { prompt_tokens: 180, completion_tokens: 40, total_tokens: 220 },
      choices: [
        {
          message: {
            role: "assistant",
            tool_calls: [
              {
                id: "call_2",
                function: { name: "extract_features", arguments: JSON.stringify({ openingTitle: "Senior Full Stack Engineer" }) },
              },
            ],
          },
        },
      ],
    });

    // Turn 3: normalize_skills
    createMock.mockResolvedValueOnce({
      usage: { prompt_tokens: 210, completion_tokens: 40, total_tokens: 250 },
      choices: [
        {
          message: {
            role: "assistant",
            tool_calls: [
              {
                id: "call_3",
                function: { name: "normalize_skills", arguments: "{}" },
              },
            ],
          },
        },
      ],
    });

    // Turn 4: deterministic_scoring
    createMock.mockResolvedValueOnce({
      usage: { prompt_tokens: 240, completion_tokens: 40, total_tokens: 280 },
      choices: [
        {
          message: {
            role: "assistant",
            tool_calls: [
              {
                id: "call_4",
                function: { name: "deterministic_scoring", arguments: "{}" },
              },
            ],
          },
        },
      ],
    });

    // Turn 5: final response
    createMock.mockResolvedValueOnce({
      usage: { prompt_tokens: 300, completion_tokens: 60, total_tokens: 360 },
      choices: [
        {
          message: {
            role: "assistant",
            content: JSON.stringify({
              recommendationReason: "Candidate has strong QA automation background with Cypress and Playwright but lacks React and Node.js development experience.",
              recommendationConfidence: 0.92,
            }),
          },
        },
      ],
    });

    (Groq as any).mockImplementation(() => ({
      chat: {
        completions: {
          create: createMock,
        },
      },
    }));

    process.env.GROQ_API_KEY = "dummy-groq-key";

    const orchestrator = new AgentOrchestrator();
    const result = await orchestrator.evaluateCandidate({
      profileId: 101,
      openingId: 5,
      s3Key: "resumes/sarah_williams_qa.pdf",
      openingTitle: "Senior Full Stack Engineer (React & Node.js)",
      openingDescription: "Building high throughput APIs with Node.js and React frontend.",
      openingLocation: "Remote",
      experienceMin: 5,
      experienceMax: 8,
    });

    expect(createMock).toHaveBeenCalled();
    const callArgs = createMock.mock.calls[0][0];

    // Ensure response_format is NOT set on request with tools
    expect(callArgs.tools).toBeDefined();
    expect(callArgs.response_format).toBeUndefined();

    expect(result.recommendationConfidence).toBe(0.92);
    expect(result.recommendationReason).toContain("Candidate has strong QA automation background");
    expect(result.recommendationVersion).toBe("v1.1");
  });

  it("should handle unknown tool requested by model gracefully", async () => {
    const mockResumeText = "John Doe 5 years node.js experience";
    const mockStructuredResume: StructuredResume = {
      experience: [{ startYear: 2019, endYear: 2024 }],
      skills: ["Node.js"],
      location: "Remote",
      education: ["B.S. Computer Science"],
      keywords: ["backend", "node.js"],
    };

    vi.spyOn(ResumeParsingTool.prototype, "parseResumeFromS3").mockResolvedValue({
      resume: mockStructuredResume,
      metadata: {
        latencyMs: 100,
        characterCount: mockResumeText.length,
        usage: { promptTokens: 50, completionTokens: 20, totalTokens: 70 },
        attempts: 1,
      },
    });

    vi.spyOn(FeatureExtractionTool.prototype, "extractFeatures").mockResolvedValue({
      requirements: {
        requiredSkills: ["Node.js"],
        keywords: ["backend"],
      },
      latencyMs: 50,
      attempts: 1,
      cached: false,
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    });

    vi.spyOn(SkillNormalizationTool.prototype, "execute").mockResolvedValue({
      result: {
        normalizedCandidateSkills: ["Node.js"],
        normalizedRequiredSkills: ["Node.js"],
        matchedSkills: ["Node.js"],
        missingSkills: [],
      },
      latencyMs: 50,
      attempts: 1,
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    });

    const createMock = vi.fn();

    // Turn 1: parse_resume
    createMock.mockResolvedValueOnce({
      usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
      choices: [
        {
          message: {
            role: "assistant",
            tool_calls: [
              {
                id: "call_1",
                function: { name: "parse_resume", arguments: JSON.stringify({ s3Key: "resumes/john.pdf" }) },
              },
            ],
          },
        },
      ],
    });

    // Turn 2: extract_features
    createMock.mockResolvedValueOnce({
      usage: { prompt_tokens: 120, completion_tokens: 20, total_tokens: 140 },
      choices: [
        {
          message: {
            role: "assistant",
            tool_calls: [
              {
                id: "call_2",
                function: { name: "extract_features", arguments: JSON.stringify({ openingTitle: "Backend Node.js Engineer" }) },
              },
            ],
          },
        },
      ],
    });

    // Turn 3: normalize_skills
    createMock.mockResolvedValueOnce({
      usage: { prompt_tokens: 140, completion_tokens: 20, total_tokens: 160 },
      choices: [
        {
          message: {
            role: "assistant",
            tool_calls: [
              {
                id: "call_3",
                function: { name: "normalize_skills", arguments: "{}" },
              },
            ],
          },
        },
      ],
    });

    // Turn 4: deterministic_scoring & an unknown tool
    createMock.mockResolvedValueOnce({
      usage: { prompt_tokens: 160, completion_tokens: 20, total_tokens: 180 },
      choices: [
        {
          message: {
            role: "assistant",
            tool_calls: [
              {
                id: "call_unknown",
                function: { name: "execute_arbitrary_shell_command", arguments: JSON.stringify({ cmd: "rm -rf /" }) },
              },
              {
                id: "call_4",
                function: { name: "deterministic_scoring", arguments: "{}" },
              },
            ],
          },
        },
      ],
    });

    // Turn 5: final response
    createMock.mockResolvedValueOnce({
      usage: { prompt_tokens: 200, completion_tokens: 30, total_tokens: 230 },
      choices: [
        {
          message: {
            role: "assistant",
            content: JSON.stringify({
              recommendationReason: "Candidate meets core backend requirements.",
              recommendationConfidence: 0.85,
            }),
          },
        },
      ],
    });

    (Groq as any).mockImplementation(() => ({
      chat: {
        completions: {
          create: createMock,
        },
      },
    }));

    process.env.GROQ_API_KEY = "dummy-groq-key";

    const orchestrator = new AgentOrchestrator();
    const result = await orchestrator.evaluateCandidate({
      profileId: 102,
      openingId: 6,
      s3Key: "resumes/john_doe.pdf",
      openingTitle: "Backend Node.js Engineer",
      openingDescription: "Node.js development",
      openingLocation: "Remote",
      experienceMin: 3,
    });

    expect(result.recommendationReason).toBe("Candidate meets core backend requirements.");
  });
});
