import type { ConnectionOptions } from 'bullmq';
import { env, redisEnabled } from '../config/env';

/** BullMQ needs a connection that never gives up mid-job. */
export function bullConnection(): ConnectionOptions {
  const url = new URL(env.REDIS_URL);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}

export const queueEnabled = redisEnabled;
