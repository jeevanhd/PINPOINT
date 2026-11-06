import 'dotenv/config';
import { beforeEach } from 'vitest';

process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret-that-is-long-enough';
process.env.REDIS_URL = '';
process.env.GEMINI_API_KEY = '';
process.env.STORAGE_DRIVER = 'local';
process.env.LOCAL_STORAGE_DIR = './storage-test';

const { prisma } = await import('../lib/prisma');

export const TABLES = [
  'recall_results',
  'recall_rounds',
  'flags',
  'places',
  'explanations',
  'topic_files',
  'topics',
  'units',
  'exams',
  'users',
] as const;

beforeEach(async () => {
  // Test database is truncated between tests; the seed lives in a separate step.
  if (!process.env.DATABASE_URL) return;
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
});

export { prisma };
