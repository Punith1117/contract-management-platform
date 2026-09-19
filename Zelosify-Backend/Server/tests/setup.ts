/*
 * Unit tests must never depend on a live Redis instance. The job
 * requirements cache is disabled by default in tests; individual tests
 * inject a fake cache when they exercise caching behaviour.
 */
process.env.JOB_REQUIREMENTS_CACHE_ENABLED =
  process.env.JOB_REQUIREMENTS_CACHE_ENABLED ?? "false";

process.env.GROQ_API_KEY =
  process.env.GROQ_API_KEY ?? "test-groq-key";