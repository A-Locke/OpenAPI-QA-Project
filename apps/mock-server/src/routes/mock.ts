import { FastifyInstance } from 'fastify';
import { ScrapeRequestSchema } from '@specguard/shared-types';
import {
  VALID_RUN_ID,
  RUNNING_RUN_ID,
  FAILED_RUN_ID,
  MISSING_FIELDS_RUN_ID,
  INVALID_TYPES_RUN_ID,
  SLOW_RUN_ID,
  VALID_INIT_RESPONSE,
  VALID_RESULTS_RESPONSE,
  MISSING_FIELDS_RESPONSE,
  INVALID_TYPES_RESPONSE,
} from '../fixtures';

const SLOW_DELAY_MS = 4000;

export async function mockRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /scrape/tiktok
   *
   * Uses the same ScrapeRequestSchema as the wrapper API so validation
   * behaviour is identical — the mock is a faithful stand-in for contract tests.
   */
  app.post('/scrape/tiktok', async (request, reply) => {
    const parsed = ScrapeRequestSchema.safeParse(request.body ?? {});

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: parsed.error.errors[0]?.message ?? 'Invalid request body',
        details: parsed.error.flatten(),
      });
    }

    return reply.status(202).send(VALID_INIT_RESPONSE);
  });

  /**
   * GET /scrape/results/:runId
   *
   * Known runIds and their responses:
   *   run-valid-abc123         → 200 valid SUCCEEDED results
   *   run-running-def456       → 200 RUNNING (empty items)
   *   run-failed-ghi789        → 200 FAILED (empty items)
   *   run-missing-fields       → 200 with missing required fields (drift test)
   *   run-invalid-types        → 200 with wrong field types (violation test)
   *   run-slow-jkl012          → 200 after 4s delay (timeout test)
   *   anything else            → 404
   */
  app.get<{ Params: { runId: string } }>(
    '/scrape/results/:runId',
    async (request, reply) => {
      const { runId } = request.params;

      switch (runId) {
        case VALID_RUN_ID:
          return reply.send(VALID_RESULTS_RESPONSE);

        case RUNNING_RUN_ID:
          return reply.send({ runId, status: 'RUNNING', items: [] });

        case FAILED_RUN_ID:
          return reply.send({ runId, status: 'FAILED', items: [] });

        case MISSING_FIELDS_RUN_ID:
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentionally malformed for testing
          return reply.send(MISSING_FIELDS_RESPONSE as any);

        case INVALID_TYPES_RUN_ID:
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- intentionally malformed for testing
          return reply.send(INVALID_TYPES_RESPONSE as any);

        case SLOW_RUN_ID:
          await delay(SLOW_DELAY_MS);
          return reply.send(VALID_RESULTS_RESPONSE);

        default:
          return reply.status(404).send({
            error: 'NOT_FOUND',
            message: `Run '${runId}' not found`,
          });
      }
    }
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
