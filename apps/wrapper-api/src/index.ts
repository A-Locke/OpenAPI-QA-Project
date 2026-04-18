import Fastify, { FastifyInstance } from 'fastify';
import { scrapeRoutes } from './routes/scrape';

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
  });

  // Health check — used by Docker HEALTHCHECK and depends_on condition
  app.get('/health', async () => ({ status: 'ok' }));

  app.register(scrapeRoutes);

  // 404 handler for unknown routes
  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({ error: 'NOT_FOUND', message: 'Route not found' });
  });

  // Global error handler
  app.setErrorHandler((err, _request, reply) => {
    app.log.error(err);

    // Undici / fetch upstream errors
    if ('cause' in err && err.cause instanceof Error) {
      const cause = err.cause as NodeJS.ErrnoException;
      if (cause.code === 'ECONNREFUSED' || cause.code === 'ENOTFOUND') {
        return reply.status(503).send({
          error: 'SERVICE_UNAVAILABLE',
          message: 'Unable to reach Apify API',
        });
      }
    }

    if (err.statusCode) {
      return reply.status(err.statusCode).send({
        error: 'REQUEST_ERROR',
        message: err.message,
      });
    }

    return reply.status(500).send({
      error: 'INTERNAL_ERROR',
      message: err.message || 'An unexpected error occurred',
    });
  });

  return app;
}

async function start(): Promise<void> {
  const app = buildApp();
  const port = parseInt(process.env.PORT ?? '3000', 10);
  try {
    await app.listen({ port, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}
