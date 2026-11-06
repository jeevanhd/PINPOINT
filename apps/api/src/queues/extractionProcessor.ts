import { getAiProvider } from '../ai';
import { logger } from '../config/logger';
import { setJob } from '../lib/jobStore';
import { getStorage } from '../storage';
import { publishToUser } from '../realtime/publish';

export interface ExtractionJobData {
  fileId: string;
  topicId: string;
  userId: string;
  storageKey: string;
  mimeType: string;
  fileName: string;
  pageCount: number;
}

/**
 * The whole upload -> extract path. Shared by the BullMQ worker and by the
 * inline driver so both behave identically.
 */
export async function processExtraction(job: ExtractionJobData): Promise<void> {
  const now = () => new Date().toISOString();

  const step = async (stage: 'reading' | 'analyzing', progress: number) => {
    await setJob({ fileId: job.fileId, topicId: job.topicId, stage, progress, updatedAt: now() });
    await publishToUser(job.userId, 'file:processing', {
      topicId: job.topicId,
      fileId: job.fileId,
      stage,
    });
    await publishToUser(job.userId, 'file:progress', {
      topicId: job.topicId,
      fileId: job.fileId,
      progress,
      stage,
    });
  };

  try {
    await step('reading', 10);
    const buffer = await getStorage().read(job.storageKey);
    await step('analyzing', 45);

    const extraction = await getAiProvider().extract({
      buffer,
      mimeType: job.mimeType,
      fileName: job.fileName,
      pageCount: job.pageCount,
    });

    await setJob({
      fileId: job.fileId,
      topicId: job.topicId,
      stage: 'done',
      progress: 100,
      updatedAt: now(),
      extraction,
    });

    await publishToUser(job.userId, 'file:done', {
      topicId: job.topicId,
      fileId: job.fileId,
      extraction,
      pageCount: job.pageCount,
    });
  } catch (err) {
    logger.error({ err, fileId: job.fileId }, 'extraction failed');
    const message = err instanceof Error ? err.message : 'Extraction failed';
    await setJob({
      fileId: job.fileId,
      topicId: job.topicId,
      stage: 'error',
      progress: 0,
      updatedAt: now(),
      error: { code: 'ai_failed', message },
    });
    await publishToUser(job.userId, 'file:error', {
      topicId: job.topicId,
      fileId: job.fileId,
      code: 'ai_failed',
      message: message.slice(0, 300),
    });
    throw err;
  }
}
