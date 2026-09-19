import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgentOrchestrator } from "../../../../src/services/ai/agent/AgentOrchestrator.js";
import { ResumeParsingTool, StructuredResume } from "../../../../src/services/ai/tools/ResumeParsingTool.js";
import Groq from "groq-sdk";

vi.mock("groq-sdk");

describe("AgentOrchestrator - Tool Calling & Authoritative Deterministic Score Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should execute Groq tool calling WITHOUT response_format json_object and maintain single deterministic score path", async () => {
    // 1. Mock ResumeParsingTool
    const mockResumeText = `
      Sarah Williams
      Senior QA Automation Lead
      6 years experience in Cypress, Playwright, Python test automation.
      Worked on end-to-end testing, REST APIs, CI/CD pipelines.
    `;
    const mockStructuredResume: StructuredResume = {
      experienceYears: 6,
      skills: ["Cypress", "Playwright", "Python"],
      normalizedSkills: ["Cypress", "Playwright", "Python"],
      location: "Remote",
      education: ["B.Tech Computer Science"],
      keywords: ["testing", "qa", "automation"],
      rawText: mockResumeText,
      sanitizedText: mockResumeText,
      characterCount: mockResumeText.length,
    };

    vi.spyOn(ResumeParsingTool.prototype, "parseResumeFromS3").mockResolvedValue(mockStructuredResume);

    // 2. Mock Groq Chat Completions create method
    const createMock = vi.fn();

    // Turn 1: Groq requests tools: parse_resume, normalize_skills, extract_features, deterministic_scoring
    createMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            role: "assistant",
            tool_calls: [
              {
                id: "call_1",
                function: {
                  name: "parse_resume",
                  arguments: JSON.stringify({ s3Key: "some-key" }),
                },
              },
              {
                id: "call_2",
                function: {
                  name: "normalize_skills",
                  arguments: JSON.stringify({ rawSkills: ["cypress", "playwright", "python"] }),
                },
              },
              {
                id: "call_3",
                function: {
                  name: "extract_features",
                  arguments: JSON.stringify({ resumeText: mockResumeText }),
                },
              },
              {
                id: "call_4",
                function: {
                  name: "deterministic_scoring",
                  arguments: JSON.stringify({ skillMatchScore: 0.0, experienceMatchScore: 1.0, locationMatchScore: 1.0 }),
                },
              },
            ],
          },
        },
      ],
    });

    // Turn 2: Groq returns final response content
    createMock.mockResolvedValueOnce({
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
      s3Key: "resumes/sarah_williams_qa.pdf",
      openingTitle: "Senior Full Stack Engineer (React & Node.js)",
      openingDescription: "Building high throughput APIs with Node.js and React frontend.",
      openingLocation: "Remote",
      experienceMin: 5,
      experienceMax: 8,
    });

    // Verify Groq create parameters:
    expect(createMock).toHaveBeenCalled();
    const callArgs = createMock.mock.calls[0][0];

    // REQUIREMENT 1: Ensure response_format is NOT set on request with tools
    expect(callArgs.tools).toBeDefined();
    expect(callArgs.response_format).toBeUndefined();

    // REQUIREMENT 6 & 8: Verify authoritative score (0.50 score for Sarah Williams)
    expect(result.recommendationScore).toBe(0.5);
    expect(result.recommended).toBe(true); // 0.50 is BORDERLINE / recommended
    expect(result.recommendationConfidence).toBe(0.92);
    expect(result.recommendationReason).toContain("Candidate has strong QA automation background");
    expect(result.recommendationVersion).toBe("v1.1");
  });

  it("should handle unknown tool requested by model gracefully", async () => {
    const mockResumeText = "John Doe 5 years node.js experience";
    const mockStructuredResume: StructuredResume = {
      experienceYears: 5,
      skills: ["Node.js"],
      normalizedSkills: ["Node.js"],
      location: "Remote",
      education: ["B.S. Computer Science"],
      keywords: ["backend", "node.js"],
      rawText: mockResumeText,
      sanitizedText: mockResumeText,
      characterCount: mockResumeText.length,
    };

    vi.spyOn(ResumeParsingTool.prototype, "parseResumeFromS3").mockResolvedValue(mockStructuredResume);

    const createMock = vi.fn();

    // Turn 1: Model requests an illegal unknown tool
    createMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            role: "assistant",
            tool_calls: [
              {
                id: "call_unknown",
                function: {
                  name: "execute_arbitrary_shell_command",
                  arguments: JSON.stringify({ cmd: "rm -rf /" }),
                },
              },
            ],
          },
        },
      ],
    });

    // Turn 2: Model returns final response after seeing tool rejection
    createMock.mockResolvedValueOnce({
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
      s3Key: "resumes/john_doe.pdf",
      openingTitle: "Backend Node.js Engineer",
      openingDescription: "Node.js development",
      openingLocation: "Remote",
      experienceMin: 3,
    });

    expect(createMock).toHaveBeenCalledTimes(2);
    expect(result.recommendationReason).toBe("Candidate meets core backend requirements.");
  });
});
