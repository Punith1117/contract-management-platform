import { Queue } from "bullmq";
import dotenv from "dotenv";

dotenv.config();

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

/**
 * Parses Redis URL into connection options for BullMQ
 */
const parseRedisUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || "localhost",
      port: parsed.port ? parseInt(parsed.port, 10) : 6379,
      password: parsed.password || undefined,
      username: parsed.username || undefined,
      tls: parsed.protocol === "rediss:" ? {} : undefined,
    };
  } catch {
    return { host: "localhost", port: 6379 };
  }
};

export const redisConnectionOptions = parseRedisUrl(REDIS_URL);

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
