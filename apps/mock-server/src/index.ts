import Fastify, { FastifyInstance } from 'fastify';
import { mockRoutes } from './routes/mock';

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'info' },
  });

  app.get('/health', async () => ({ status: 'ok' }));

  app.register(mockRoutes);

  app.setNotFoundHandler((_request, reply) => {
    reply.status(404).send({ error: 'NOT_FOUND', message: 'Route not found' });
  });

  return app;
}

async function start(): Promise<void> {
  const app = buildApp();
  const port = parseInt(process.env.PORT ?? '4000', 10);
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
