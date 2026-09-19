import { Queue } from "bullmq";
import dotenv from "dotenv";
import { redisConnectionOptions } from "../config/redis/redisConfig.js";

dotenv.config();

export { redisConnectionOptions };

export const RESUME_QUEUE_NAME = "resume-processing-queue";

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
    console.log(`[BullMQ Producer] Enqueued resume processing job (JobId: ${job.id}) for profileId: ${profileId}`);
    return job;
  } catch (error: any) {
    console.error(`[BullMQ Producer] Failed to enqueue job for profileId ${profileId}:`, error?.message || error);
    return null;
  }
}
