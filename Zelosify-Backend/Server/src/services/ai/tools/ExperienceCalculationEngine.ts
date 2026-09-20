import { StructuredResume } from "./ResumeParsingTool.js";

export class ExperienceCalculationEngine {
  calculateExperienceYears(
    periods: StructuredResume["experience"],
  ): number {
    if (periods.length === 0) {
      return 0;
    }

    const currentYear = new Date().getFullYear();

    const intervals = periods
      .map(({ startYear, endYear }) => ({
        startYear,
        endYear: endYear ?? currentYear,
      }))
      .filter(
        ({ startYear, endYear }) =>
          endYear >= startYear,
      )
      .sort(
        (a, b) =>
          a.startYear - b.startYear,
      );

    if (intervals.length === 0) {
      return 0;
    }

    // Merge overlapping employment periods so that
    // overlapping jobs are not double-counted.
    const merged: {
      startYear: number;
      endYear: number;
    }[] = [];

    for (const interval of intervals) {
      const previous =
        merged[merged.length - 1];

      if (
        previous &&
        interval.startYear <= previous.endYear
      ) {
        previous.endYear = Math.max(
          previous.endYear,
          interval.endYear,
        );
      } else {
        merged.push({ ...interval });
      }
    }

    return merged.reduce(
      (total, interval) =>
        total +
        (interval.endYear - interval.startYear),
      0,
    );
  }
}
