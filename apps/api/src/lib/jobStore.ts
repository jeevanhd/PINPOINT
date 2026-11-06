import type { Extraction } from '@pinpoint/shared';
import { getRedis } from './redis';

export type JobStage = 'queued' | 'reading' | 'uploading' | 'analyzing' | 'done' | 'error';

export interface JobRecord {
  fileId: string;
  topicId: string;
  stage: JobStage;
  progress: number;
  updatedAt: string;
  extraction?: Extraction;
  error?: { code: string; message: string };
}

/**
 * Upload job status lives here (Redis), never in Postgres. Without Redis a
 * process-local map stands in so a single-process dev run still reconnects.
 */
const memory = new Map<string, JobRecord>();
const TTL_SECONDS = 60 * 60;

export async function setJob(record: JobRecord): Promise<void> {
  const key = `job:${record.fileId}`;
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(key, JSON.stringify(record), 'EX', TTL_SECONDS);
      return;
    } catch {
      /* fall through */
    }
  }
  memory.set(key, record);
}

export async function getJob(fileId: string): Promise<JobRecord | null> {
  const key = `job:${fileId}`;
  const redis = getRedis();
  if (redis) {
    try {
      const raw = await redis.get(key);
      return raw ? (JSON.parse(raw) as JobRecord) : null;
    } catch {
      return null;
    }
  }
  return memory.get(key) ?? null;
}
