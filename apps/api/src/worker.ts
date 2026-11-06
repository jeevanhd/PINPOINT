import { Worker, type Job } from 'bullmq';
import { env } from './config/env';
import { logger } from './config/logger';
import { disconnectPrisma } from './lib/prisma';
import { closeRedis } from './lib/redis';
import { bullConnection, queueEnabled } from './queues/connection';
import { EXTRACTION_QUEUE } from './queues/queues';
import { processExtraction, type ExtractionJobData } from './queues/extractionProcessor';

/**
 * Separate worker process: PDF/image processing and Gemini calls happen here,
 * never in the API request path. Progress reaches the browser through Redis
 * pub/sub into the user's socket room.
 */
async function main(): Promise<void> {
  if (!queueEnabled) {
    logger.error('REDIS_URL is required to run the worker. The API falls back to inline jobs.');
    process.exitCode = 1;
    return;
  }

  const worker = new Worker<ExtractionJobData>(
    EXTRACTION_QUEUE,
    async (job: Job<ExtractionJobData>) => {
      logger.info({ fileId: job.data.fileId, attempt: job.attemptsMade + 1 }, 'extraction job start');
      await processExtraction(job.data);
    },
    { connection: bullConnection(), concurrency: 2 },
  );

  worker.on('failed', (job, err) => {
    logger.error({ err, fileId: job?.data.fileId }, 'extraction job failed');
  });
  worker.on('completed', (job) => {
    logger.info({ fileId: job.data.fileId }, 'extraction job completed');
  });

  logger.info({ queue: EXTRACTION_QUEUE, env: env.NODE_ENV }, 'worker ready');

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'worker shutting down');
    await worker.close();
    await closeRedis();
    await disconnectPrisma();
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

void main();
