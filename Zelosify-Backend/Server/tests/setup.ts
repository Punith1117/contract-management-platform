import dotenv from "dotenv";

dotenv.config({ path: ".env.test" });

process.env.NODE_ENV = "test";

process.env.JOB_REQUIREMENTS_CACHE_ENABLED =
  process.env.JOB_REQUIREMENTS_CACHE_ENABLED ?? "false";

process.env.GROQ_API_KEY =
  process.env.GROQ_API_KEY ?? "test-groq-key";
