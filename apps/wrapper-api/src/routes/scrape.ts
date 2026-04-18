import { FastifyInstance } from 'fastify';
import { ScrapeRequestSchema } from '@specguard/shared-types';
import type { TikTokVideo } from '@specguard/shared-types';
import { startRun, getRun, getDatasetItems } from '../services/apify';
import { normalizeVideo } from '../services/normalizer';

export async function scrapeRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /scrape/tiktok
   * Validates the request via Zod, triggers an Apify Actor run,
   * and returns the runId + initial status.
   */
  app.post('/scrape/tiktok', async (request, reply) => {
    const parsed = ScrapeRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: parsed.error.errors[0]?.message ?? 'Invalid request body',
        details: parsed.error.flatten(),
      });
    }

    const run = await startRun(parsed.data);

    return reply.status(202).send({
      runId: run.id,
      status: run.status,
      startedAt: run.startedAt,
    });
  });

  /**
   * GET /scrape/results/:runId
   * Returns current run status and, once SUCCEEDED, normalized video items.
   */
  app.get<{ Params: { runId: string } }>(
    '/scrape/results/:runId',
    async (request, reply) => {
      const { runId } = request.params;

      const run = await getRun(runId);

      if (!run) {
        return reply.status(404).send({
          error: 'NOT_FOUND',
          message: `Run '${runId}' not found`,
        });
      }

      let items: TikTokVideo[] = [];

      if (run.status === 'SUCCEEDED' && run.defaultDatasetId) {
        const rawItems = await getDatasetItems(run.defaultDatasetId);
        items = rawItems.map(normalizeVideo);
      }

      return reply.send({
        runId,
        status: run.status,
        items,
      });
    }
  );
}
