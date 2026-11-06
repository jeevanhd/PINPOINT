import { createServer } from 'node:http';
import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { disconnectPrisma } from './lib/prisma';
import { closeRedis } from './lib/redis';
import { closeIo, createIo, setRecallResumeHandler } from './realtime/io';
import { closeQueue } from './queues/queues';
import { recallService } from './services/recall.service';

async function main(): Promise<void> {
  const app = createApp();
  const server = createServer(app);
  await createIo(server);
  setRecallResumeHandler((userId, roundId) => recallService.state(userId, roundId));

  server.listen(env.API_PORT, () => {
    logger.info({ port: env.API_PORT, env: env.NODE_ENV }, 'pinpoint api listening');
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'api shutting down');
    server.close();
    await closeIo();
    await closeQueue();
    await closeRedis();
    await disconnectPrisma();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.fatal({ err }, 'api failed to start');
  process.exit(1);
});
