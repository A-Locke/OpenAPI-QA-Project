import { fetch } from 'undici';
import { ApifyRun, ApifyRunSchema } from '@specguard/shared-types';
import { ScrapeRequest } from '@specguard/shared-types';

const BASE_URL = 'https://api.apify.com/v2';
const TOKEN = process.env.APIFY_TOKEN ?? '';
const ACTOR_ID = process.env.APIFY_ACTOR_ID ?? 'clockworks~tiktok-scraper';
const TIMEOUT_MS = parseInt(process.env.APIFY_TIMEOUT_MS ?? '30000', 10);

/**
 * Starts an Apify Actor run with the normalized input.
 * Maps internal ScrapeRequest fields to the upstream actor's inputSchema.
 * Validates the response at the boundary using ApifyRunSchema.
 */
export async function startRun(input: ScrapeRequest): Promise<ApifyRun> {
  const url = `${BASE_URL}/acts/${ACTOR_ID}/runs?token=${TOKEN}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hashtags: input.hashtags,
      profiles: input.profiles,
      searchQueries: input.searchQueries,
      postURLs: input.postURLs,
      resultsPerPage: input.resultsPerPage ?? 10,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new UpstreamError(`Apify /runs returned ${res.status}`, res.status);
  }

  const body = (await res.json()) as { data: unknown };
  return ApifyRunSchema.parse(body.data);
}

/**
 * Fetches run metadata by runId.
 * Returns null when the run is not found (404) so the route can return 404.
 * Validates the response at the boundary.
 */
export async function getRun(runId: string): Promise<ApifyRun | null> {
  const url = `${BASE_URL}/actor-runs/${runId}?token=${TOKEN}`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (res.status === 404) return null;

  if (!res.ok) {
    throw new UpstreamError(`Apify /actor-runs/${runId} returned ${res.status}`, res.status);
  }

  const body = (await res.json()) as { data: unknown };
  return ApifyRunSchema.parse(body.data);
}

/**
 * Fetches dataset items for a completed run.
 * Returns an array of raw unknown objects to be normalized by normalizeVideo().
 */
export async function getDatasetItems(datasetId: string): Promise<unknown[]> {
  const url = `${BASE_URL}/datasets/${datasetId}/items?token=${TOKEN}&format=json&clean=true`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new UpstreamError(`Apify /datasets/${datasetId}/items returned ${res.status}`, res.status);
  }

  const body = await res.json();
  return Array.isArray(body) ? body : [];
}

// ── Error type ───────────────────────────────────────────────────────────────

export class UpstreamError extends Error {
  constructor(
    message: string,
    public readonly upstreamStatus: number
  ) {
    super(message);
    this.name = 'UpstreamError';
  }
}
