import { Worker, Job } from "bullmq";
import dotenv from "dotenv";
import prisma from "../config/prisma/prisma.js";
import { RESUME_QUEUE_NAME, redisConnectionOptions } from "../queues/resumeQueue.js";
import { AgentOrchestrator } from "../services/ai/agent/AgentOrchestrator.js";
import { AILogger } from "../services/ai/utils/logger.js";

dotenv.config();

const concurrency = process.env.RESUME_WORKER_CONCURRENCY
  ? parseInt(process.env.RESUME_WORKER_CONCURRENCY, 10)
  : 1;

const orchestrator = new AgentOrchestrator();

export const resumeWorker = new Worker(
  RESUME_QUEUE_NAME,
  async (job: Job<{ profileId: number }>) => {
    const startTime = Date.now();
    const { profileId } = job.data;

    AILogger.info("resume_job_started", {
      jobId: job.id,
      profileId,
      attempt: job.attemptsMade + 1,
    });

    // 1. Fetch hiring profile and opening metadata from PostgreSQL
    const profile = await prisma.hiringProfile.findUnique({
      where: { id: profileId },
      include: { opening: true },
    });

    if (!profile) {
      AILogger.warn("resume_job_skipped", {
        jobId: job.id,
        profileId,
        reason: "not_found",
      });
      return;
    }

    if (profile.isDeleted) {
      AILogger.warn("resume_job_skipped", {
        jobId: job.id,
        profileId,
        reason: "deleted",
      });
      return;
    }

    // 2. Execute AI Agent Orchestration Pipeline
    const result = await orchestrator.evaluateCandidate({
      profileId: profile.id,
      openingId: profile.openingId,
      s3Key: profile.s3Key,
      openingTitle: profile.opening.title,
      openingDescription: profile.opening.description,
      openingLocation: profile.opening.location,
      experienceMin: profile.opening.experienceMin,
      experienceMax: profile.opening.experienceMax,
    });

    const recommendationLatencyMs = Date.now() - startTime;

    // 3. Atomically update hiringProfile with AI recommendation metadata
    await prisma.hiringProfile.update({
      where: { id: profile.id },
      data: {
        recommended: result.recommended,
        recommendationScore: result.recommendationScore,
        recommendationReason: result.recommendationReason,
        recommendationLatencyMs,
        recommendationVersion: result.recommendationVersion,
        recommendationConfidence: result.recommendationConfidence,
        recommendedAt: new Date(),
      },
    });

    AILogger.info("resume_job_completed", {
      jobId: job.id,
      profileId: profile.id,
      totalLatencyMs: recommendationLatencyMs,
    });
  },
  {
    connection: redisConnectionOptions,
    concurrency,
  }
);

// Worker Event Listeners
resumeWorker.on("failed", (job, err) => {
  AILogger.error("resume_job_failed", {
    jobId: job?.id,
    profileId: job?.data?.profileId,
    error: err?.message || String(err),
  });
});

resumeWorker.on("error", (err) => {
  AILogger.error("resume_worker_error", {
    error: err?.message || String(err),
  });
});
