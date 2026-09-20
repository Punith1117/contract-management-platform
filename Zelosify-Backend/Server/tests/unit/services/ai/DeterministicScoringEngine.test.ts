import { describe, expect, it } from "vitest";
import {
  DeterministicScoringEngine,
  DeterministicScoringInput,
} from "../../../../src/services/ai/tools/DeterministicScoringEngine.js";

describe("DeterministicScoringEngine", () => {
  const engine = new DeterministicScoringEngine();

  const createInput = (
    overrides: Partial<DeterministicScoringInput> = {},
  ): DeterministicScoringInput => ({
    matchedSkills: ["Node.js", "PostgreSQL"],
    requiredSkills: ["Node.js", "PostgreSQL"],
    candidateExperienceYears: 5,
    minExperienceRequired: 5,
    maxExperienceRequired: 8,
    candidateLocation: "Bengaluru",
    openingLocation: "Bengaluru",
    ...overrides,
  });

  describe("experience boundaries", () => {
    it("returns 0 when experience is below the minimum", () => {
      const result = engine.calculateScore(
        createInput({
          candidateExperienceYears: 4,
          minExperienceRequired: 5,
        }),
      );

      expect(result.experienceMatchScore).toBe(0);
    });

    it("returns 1 at the minimum experience boundary", () => {
      const result = engine.calculateScore(
        createInput({
          candidateExperienceYears: 5,
        }),
      );

      expect(result.experienceMatchScore).toBe(1);
    });

    it("returns 1 at the maximum experience boundary", () => {
      const result = engine.calculateScore(
        createInput({
          candidateExperienceYears: 8,
        }),
      );

      expect(result.experienceMatchScore).toBe(1);
    });

    it("returns 0.8 when experience exceeds the maximum", () => {
      const result = engine.calculateScore(
        createInput({
          candidateExperienceYears: 10,
        }),
      );

      expect(result.experienceMatchScore).toBe(0.8);
    });

    it("throws when candidate experience is not finite", () => {
      expect(() =>
        engine.calculateScore(
          createInput({
            candidateExperienceYears: Number.NaN,
          }),
        ),
      ).toThrow("candidateExperienceYears must be a finite number.");
    });
  });

  describe("skill overlap", () => {
    it("calculates skill match as matched skills divided by required skills", () => {
      const result = engine.calculateScore(
        createInput({
          matchedSkills: ["Node.js"],
          requiredSkills: ["Node.js", "PostgreSQL", "Redis"],
        }),
      );

      expect(result.skillMatchScore).toBeCloseTo(1 / 3);
    });

    it("returns 1 when all required skills are matched", () => {
      const result = engine.calculateScore(
        createInput({
          matchedSkills: ["Node.js", "PostgreSQL"],
          requiredSkills: ["Node.js", "PostgreSQL"],
        }),
      );

      expect(result.skillMatchScore).toBe(1);
    });

    it("returns 0 when no required skills are matched", () => {
      const result = engine.calculateScore(
        createInput({
          matchedSkills: [],
          requiredSkills: ["Node.js", "PostgreSQL"],
        }),
      );

      expect(result.skillMatchScore).toBe(0);
    });

    it("returns 1 when there are no required skills", () => {
      const result = engine.calculateScore(
        createInput({
          matchedSkills: [],
          requiredSkills: [],
        }),
      );

      expect(result.skillMatchScore).toBe(1);
    });
  });

  describe("location logic", () => {
    it("returns 1 for a remote opening regardless of candidate location", () => {
      const result = engine.calculateScore(
        createInput({
          candidateLocation: "Mumbai",
          openingLocation: "Remote",
        }),
      );

      expect(result.locationMatchScore).toBe(1);
    });

    it("returns 1 for an exact location match", () => {
      const result = engine.calculateScore(
        createInput({
          candidateLocation: "Bengaluru",
          openingLocation: "Bengaluru",
        }),
      );

      expect(result.locationMatchScore).toBe(1);
    });

    it("treats location matching as case and whitespace insensitive", () => {
      const result = engine.calculateScore(
        createInput({
          candidateLocation: "  Bengaluru ",
          openingLocation: "BENGALURU",
        }),
      );

      expect(result.locationMatchScore).toBe(1);
    });

    it("returns 0.5 for an onsite location mismatch", () => {
      const result = engine.calculateScore(
        createInput({
          candidateLocation: "Mumbai",
          openingLocation: "Bengaluru",
        }),
      );

      expect(result.locationMatchScore).toBe(0.5);
    });
  });

  describe("score formula", () => {
    it("applies the authoritative weighted scoring formula", () => {
      const result = engine.calculateScore(
        createInput({
          matchedSkills: ["Node.js"],
          requiredSkills: ["Node.js", "PostgreSQL"],
          candidateExperienceYears: 5,
          candidateLocation: "Mumbai",
          openingLocation: "Bengaluru",
        }),
      );

      // skill = 1/2, experience = 1, location = 0.5
      // final = 0.5 * 0.5 + 0.3 * 1 + 0.2 * 0.5
      //       = 0.65
      expect(result.skillMatchScore).toBe(0.5);
      expect(result.experienceMatchScore).toBe(1);
      expect(result.locationMatchScore).toBe(0.5);
      expect(result.finalScore).toBe(0.65);
    });

    it("marks scores at or above 0.75 as recommended", () => {
      const result = engine.calculateScore(
        createInput({
          matchedSkills: ["Node.js", "PostgreSQL"],
          requiredSkills: ["Node.js", "PostgreSQL"],
          candidateExperienceYears: 5,
          candidateLocation: "Bengaluru",
          openingLocation: "Bengaluru",
        }),
      );

      expect(result.finalScore).toBe(1);
      expect(result.recommended).toBe(true);
      expect(result.decisionCategory).toBe("RECOMMENDED");
    });

    it("marks scores from 0.5 to below 0.75 as borderline", () => {
      const result = engine.calculateScore(
        createInput({
          matchedSkills: ["Node.js"],
          requiredSkills: ["Node.js", "PostgreSQL"],
          candidateExperienceYears: 5,
          candidateLocation: "Mumbai",
          openingLocation: "Bengaluru",
        }),
      );

      expect(result.finalScore).toBe(0.65);
      expect(result.recommended).toBe(false);
      expect(result.decisionCategory).toBe("BORDERLINE");
    });

    it("marks scores below 0.5 as not recommended", () => {
      const result = engine.calculateScore(
        createInput({
          matchedSkills: [],
          requiredSkills: ["Node.js", "PostgreSQL"],
          candidateExperienceYears: 4,
          candidateLocation: "Mumbai",
          openingLocation: "Bengaluru",
        }),
      );

      expect(result.finalScore).toBe(0.1);
      expect(result.recommended).toBe(false);
      expect(result.decisionCategory).toBe("NOT_RECOMMENDED");
    });
  });
});
