export interface ScoringResult {
  skillMatchScore: number;
  experienceMatchScore: number;
  locationMatchScore: number;
  finalScore: number;
  recommended: boolean;
  decisionCategory: "RECOMMENDED" | "BORDERLINE" | "NOT_RECOMMENDED";
  explanation: string;
}

export interface DeterministicScoringInput {
  matchedSkills: string[];
  requiredSkills: string[];

  candidateExperienceYears: number;
  minExperienceRequired: number;
  maxExperienceRequired?: number | null;

  candidateLocation: string;
  openingLocation: string;
}

export class DeterministicScoringEngine {
  calculateScore(input: DeterministicScoringInput): ScoringResult {
    const {
      matchedSkills,
      requiredSkills,
      candidateExperienceYears,
      minExperienceRequired,
      maxExperienceRequired,
      candidateLocation,
      openingLocation,
    } = input;

    const skillMatchScore = this.calculateSkillMatch(
      matchedSkills,
      requiredSkills
    );

    const experienceMatchScore = this.calculateExperienceMatch(
      candidateExperienceYears,
      minExperienceRequired,
      maxExperienceRequired
    );

    const locationMatchScore = this.calculateLocationMatch(
      candidateLocation,
      openingLocation
    );

    const rawFinalScore =
      0.5 * skillMatchScore +
      0.3 * experienceMatchScore +
      0.2 * locationMatchScore;

    const finalScore =
      Math.round(Math.min(1, Math.max(0, rawFinalScore)) * 100) / 100;

    const decisionCategory = this.getDecisionCategory(finalScore);

    const recommended = decisionCategory === "RECOMMENDED";

    const explanation = this.buildExplanation({
      skillMatchScore,
      experienceMatchScore,
      locationMatchScore,
      finalScore,
      decisionCategory,
      matchedSkills,
      requiredSkills,
      candidateExperienceYears,
      minExperienceRequired,
      maxExperienceRequired,
      candidateLocation,
      openingLocation,
    });

    return {
      skillMatchScore,
      experienceMatchScore,
      locationMatchScore,
      finalScore,
      recommended,
      decisionCategory,
      explanation,
    };
  }

  private calculateSkillMatch(
    matchedSkills: string[],
    requiredSkills: string[]
  ): number {
    if (requiredSkills.length === 0) {
      return 1;
    }

    return Math.min(
      1,
      matchedSkills.length / requiredSkills.length
    );
  }

  private calculateExperienceMatch(
    candidateExperienceYears: number,
    minExperienceRequired: number,
    maxExperienceRequired?: number | null
  ): number {
    if (candidateExperienceYears < minExperienceRequired) {
      return 0;
    }

    if (
      maxExperienceRequired !== null &&
      maxExperienceRequired !== undefined &&
      candidateExperienceYears > maxExperienceRequired
    ) {
      return 0.8;
    }

    return 1;
  }

  private calculateLocationMatch(
    candidateLocation: string,
    openingLocation: string
  ): number {
    const candidate = candidateLocation.trim().toLowerCase();
    const opening = openingLocation.trim().toLowerCase();

    if (opening === "remote") {
      return 1;
    }

    if (candidate && opening && candidate === opening) {
      return 1;
    }

    return 0.5;
  }

  private getDecisionCategory(
    finalScore: number
  ): ScoringResult["decisionCategory"] {
    if (finalScore >= 0.75) {
      return "RECOMMENDED";
    }

    if (finalScore >= 0.5) {
      return "BORDERLINE";
    }

    return "NOT_RECOMMENDED";
  }

  private buildExplanation(input: {
    skillMatchScore: number;
    experienceMatchScore: number;
    locationMatchScore: number;
    finalScore: number;
    decisionCategory: ScoringResult["decisionCategory"];

    matchedSkills: string[];
    requiredSkills: string[];

    candidateExperienceYears: number;
    minExperienceRequired: number;
    maxExperienceRequired?: number | null;

    candidateLocation: string;
    openingLocation: string;
  }): string {
    const {
      skillMatchScore,
      experienceMatchScore,
      locationMatchScore,
      matchedSkills,
      requiredSkills,
      candidateExperienceYears,
      minExperienceRequired,
      maxExperienceRequired,
      candidateLocation,
      openingLocation,
    } = input;

    const skillPercent = Math.round(skillMatchScore * 100);
    const experiencePercent = Math.round(experienceMatchScore * 100);
    const locationPercent = Math.round(locationMatchScore * 100);

    const matchedText =
      matchedSkills.length > 0
        ? matchedSkills.join(", ")
        : "none";

    const requiredText =
      requiredSkills.length > 0
        ? requiredSkills.join(", ")
        : "none";

    let experienceText: string;

    if (candidateExperienceYears < minExperienceRequired) {
      experienceText =
        `Candidate has ${candidateExperienceYears} years of experience, ` +
        `below the minimum requirement of ${minExperienceRequired} years.`;
    } else if (
      maxExperienceRequired !== null &&
      maxExperienceRequired !== undefined &&
      candidateExperienceYears > maxExperienceRequired
    ) {
      experienceText =
        `Candidate has ${candidateExperienceYears} years of experience, ` +
        `above the maximum preferred range of ${maxExperienceRequired} years.`;
    } else {
      experienceText =
        `Candidate has ${candidateExperienceYears} years of experience, ` +
        `within the required range.`;
    }

    let locationText: string;

    if (openingLocation.trim().toLowerCase() === "remote") {
      locationText = "The opening is remote.";
    } else if (
      candidateLocation.trim() &&
      candidateLocation.trim().toLowerCase() ===
      openingLocation.trim().toLowerCase()
    ) {
      locationText =
        `Candidate location (${candidateLocation}) matches the opening location.`;
    } else {
      locationText =
        `Candidate location (${candidateLocation || "unspecified"}) ` +
        `does not exactly match the opening location (${openingLocation}).`;
    }

    return (
      `Skill match: ${skillPercent}% ` +
      `(matched: ${matchedText}; required: ${requiredText}). ` +
      `${experienceText} ` +
      `Experience score: ${experiencePercent}%. ` +
      `${locationText} ` +
      `Location score: ${locationPercent}%.`
    );
  }
}
