import { createHash } from 'node:crypto';
import { env } from '../config/env';
import { getRedis } from '../lib/redis';

const memory = new Map<string, { value: string; expiresAt: number }>();

export function cacheKey(parts: (string | Buffer)[]): string {
  const hash = createHash('sha256');
  for (const part of parts) hash.update(part);
  return `ai:${hash.digest('hex')}`;
}

/**
 * Development cache for repeated AI calls. Redis when available, otherwise an
 * in-process map so a demo never pays twice for the same prompt.
 */
export async function cacheGet(key: string): Promise<string | null> {
  const redis = getRedis();
  if (redis) {
    try {
      return await redis.get(key);
    } catch {
      return null;
    }
  }
  const hit = memory.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    memory.delete(key);
    return null;
  }
  return hit.value;
}

export async function cacheSet(key: string, value: string): Promise<void> {
  if (env.AI_CACHE_TTL_SECONDS <= 0) return;
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(key, value, 'EX', env.AI_CACHE_TTL_SECONDS);
      return;
    } catch {
      /* fall through to memory */
    }
  }
  memory.set(key, { value, expiresAt: Date.now() + env.AI_CACHE_TTL_SECONDS * 1000 });
}
