import Redis from 'ioredis';
import { env, redisEnabled } from '../config/env';
import { logger } from '../config/logger';

let client: Redis | null = null;
let subscriber: Redis | null = null;
let publisher: Redis | null = null;

function make(name: string): Redis {
  const c = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
  });
  c.on('error', (err) => logger.warn({ err, name }, 'redis error'));
  return c;
}

export function getRedis(): Redis | null {
  if (!redisEnabled) return null;
  if (!client) client = make('client');
  return client;
}

export function getRedisPublisher(): Redis | null {
  if (!redisEnabled) return null;
  if (!publisher) publisher = make('publisher');
  return publisher;
}

export function getRedisSubscriber(): Redis | null {
  if (!redisEnabled) return null;
  if (!subscriber) subscriber = make('subscriber');
  return subscriber;
}

export async function pingRedis(): Promise<boolean> {
  const c = getRedis();
  if (!c) return false;
  try {
    return (await c.ping()) === 'PONG';
  } catch {
    return false;
  }
}

export async function closeRedis(): Promise<void> {
  await Promise.all(
    [client, subscriber, publisher].filter((c): c is Redis => Boolean(c)).map((c) => c.quit()),
  );
  client = null;
  subscriber = null;
  publisher = null;
}
