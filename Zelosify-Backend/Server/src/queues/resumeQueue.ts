import { Queue } from "bullmq";
import dotenv from "dotenv";
import { redisConnectionOptions } from "../config/redis/redisConfig.js";
import { AILogger } from "../services/ai/utils/logger.js";

dotenv.config();

export { redisConnectionOptions };

export const RESUME_QUEUE_NAME = process.env.RESUME_QUEUE_NAME || "resume-processing-queue";

export const resumeQueue = new Queue(RESUME_QUEUE_NAME, {
  connection: redisConnectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

/**
 * Enqueue a candidate profile for asynchronous AI analysis
 */
export async function enqueueResumeProcessingJob(profileId: number) {
  try {
    const job = await resumeQueue.add(
      "process-resume",
      { profileId },
      {
        jobId: `profile-${profileId}`, // Ensure job deduplication per profile
      }
    );
    return job;
  } catch (error: any) {
    AILogger.error("resume_job_enqueue_failed", {
      profileId,
      error: error?.message || String(error),
    });
    return null;
  }
}
