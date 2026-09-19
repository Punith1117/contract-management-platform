import { Worker, Job } from "bullmq";
import dotenv from "dotenv";
import prisma from "../config/prisma/prisma.js";
import { RESUME_QUEUE_NAME, redisConnectionOptions } from "../queues/resumeQueue.js";
import { AgentOrchestrator } from "../services/ai/agent/AgentOrchestrator.js";

dotenv.config();

const concurrency = process.env.RESUME_WORKER_CONCURRENCY
  ? parseInt(process.env.RESUME_WORKER_CONCURRENCY, 10)
  : 2;

const orchestrator = new AgentOrchestrator();

console.log(`[BullMQ Worker] Starting Resume Processing Worker... (Concurrency: ${concurrency})`);

export const resumeWorker = new Worker(
  RESUME_QUEUE_NAME,
  async (job: Job<{ profileId: number }>) => {
    const startTime = Date.now();
    const { profileId } = job.data;

    console.log(`[BullMQ Worker] Job ${job.id} started for profileId: ${profileId} (Attempt ${job.attemptsMade + 1})`);

    // 1. Fetch hiring profile and opening metadata from PostgreSQL
    const profile = await prisma.hiringProfile.findUnique({
      where: { id: profileId },
      include: { opening: true },
    });

    if (!profile) {
      console.warn(`[BullMQ Worker] Profile ID ${profileId} not found in database. Skipping job.`);
      return;
    }

    if (profile.isDeleted) {
      console.warn(`[BullMQ Worker] Profile ID ${profileId} is deleted. Skipping job.`);
      return;
    }

    // 2. Execute AI Agent Orchestration Pipeline
    console.log(`[BullMQ Worker] Executing agent analysis for profile ${profileId} on opening "${profile.opening.title}"...`);

    const result = await orchestrator.evaluateCandidate({
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

    console.log(
      `[BullMQ Worker] ✅ Job ${job.id} completed successfully for profile ${profile.id} in ${recommendationLatencyMs}ms. Score: ${result.recommendationScore}, Recommended: ${result.recommended}`
    );
  },
  {
    connection: redisConnectionOptions,
    concurrency,
  }
);

// Worker Event Listeners
resumeWorker.on("completed", (job) => {
  console.log(`[BullMQ Worker Event] Job ${job.id} completed.`);
});

resumeWorker.on("failed", (job, err) => {
  console.error(`[BullMQ Worker Event] Job ${job?.id} failed with error:`, err?.message || err);
});

resumeWorker.on("error", (err) => {
  console.error("[BullMQ Worker Event] Worker error:", err);
});
