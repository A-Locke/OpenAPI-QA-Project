import { z } from 'zod';
import { TikTokVideoSchema } from './video';

export const RunStatusSchema = z.enum([
  'READY',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'TIMED-OUT',
  'ABORTED',
]);

export type RunStatus = z.infer<typeof RunStatusSchema>;

/**
 * Internal wrapper request schema.
 * Exposes a stable, capped subset of the upstream actor's inputSchema.
 * resultsPerPage is capped at 100 (vs upstream's 1,000,000).
 */
export const ScrapeRequestSchema = z
  .object({
    hashtags: z.array(z.string()).optional(),
    profiles: z.array(z.string()).optional(),
    searchQueries: z.array(z.string()).optional(),
    postURLs: z.array(z.string().url()).optional(),
    resultsPerPage: z.number().int().min(1).max(100).default(10).optional(),
  })
  .refine(
    (d) =>
      (d.hashtags?.length ?? 0) > 0 ||
      (d.profiles?.length ?? 0) > 0 ||
      (d.searchQueries?.length ?? 0) > 0 ||
      (d.postURLs?.length ?? 0) > 0,
    { message: 'At least one of hashtags, profiles, searchQueries, or postURLs must be provided' }
  );

export type ScrapeRequest = z.infer<typeof ScrapeRequestSchema>;

/** Response from POST /scrape/tiktok */
export const ScrapeInitResponseSchema = z.object({
  runId: z.string(),
  status: RunStatusSchema,
  startedAt: z.string().datetime(),
});

export type ScrapeInitResponse = z.infer<typeof ScrapeInitResponseSchema>;

/** Response from GET /scrape/results/:runId */
export const ScrapeResultsResponseSchema = z.object({
  runId: z.string(),
  status: RunStatusSchema,
  items: z.array(TikTokVideoSchema),
});

export type ScrapeResultsResponse = z.infer<typeof ScrapeResultsResponseSchema>;

/** Raw Apify run metadata returned by the actor /runs endpoint */
export const ApifyRunSchema = z.object({
  id: z.string(),
  actId: z.string().optional(),
  status: z.string(),
  startedAt: z.string(),
  finishedAt: z.string().optional().nullable(),
  defaultDatasetId: z.string().optional(),
  defaultKeyValueStoreId: z.string().optional(),
});

export type ApifyRun = z.infer<typeof ApifyRunSchema>;
