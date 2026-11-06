import { Queue } from 'bullmq';
import { logger } from '../config/logger';
import { setJob } from '../lib/jobStore';
import { bullConnection, queueEnabled } from './connection';
import { processExtraction, type ExtractionJobData } from './extractionProcessor';

export const EXTRACTION_QUEUE = 'topic-extraction';

let queue: Queue<ExtractionJobData> | null = null;

function getQueue(): Queue<ExtractionJobData> | null {
  if (!queueEnabled) return null;
  if (!queue) queue = new Queue<ExtractionJobData>(EXTRACTION_QUEUE, { connection: bullConnection() });
  return queue;
}

export async function enqueueExtraction(data: ExtractionJobData): Promise<void> {
  await setJob({
    fileId: data.fileId,
    topicId: data.topicId,
    stage: 'queued',
    progress: 0,
    updatedAt: new Date().toISOString(),
  });

  const q = getQueue();
  if (q) {
    await q.add('extract', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 50,
      removeOnFail: 100,
    });
    return;
  }

  // No Redis configured: run inline, off the request path.
  logger.warn('REDIS_URL empty - running extraction inline instead of BullMQ');
  setImmediate(() => {
    void processExtraction(data).catch((err) => logger.error({ err }, 'inline extraction failed'));
  });
}

export async function closeQueue(): Promise<void> {
  if (queue) await queue.close();
  queue = null;
}
