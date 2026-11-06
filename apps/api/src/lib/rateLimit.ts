import rateLimit, { type Options } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { env, isTest, redisEnabled } from '../config/env';
import { getRedis } from './redis';

/**
 * Per-user rate limiting. Keys are user ids, never IPs, so a shared campus
 * network cannot lock a whole class out. Falls back to an in-memory store when
 * Redis is not configured (development only).
 */
export function createUserRateLimiter(opts: { windowMs: number; max: number; prefix: string }) {
  const redis = redisEnabled ? getRedis() : null;
  const store: Options['store'] | undefined = redis
    ? new RedisStore({
        sendCommand: (...args: string[]) => redis.call(...(args as [string, ...string[]])) as Promise<never>,
        prefix: `rl:${opts.prefix}:`,
      })
    : undefined;

  return rateLimit({
    windowMs: opts.windowMs,
    limit: isTest ? 10_000 : opts.max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.id ?? req.ip ?? 'anonymous',
    store,
    message: {
      error: {
        code: 'too_many_requests',
        message: 'You are going a bit fast. Give it a few seconds and try again.',
      },
    },
    ...(env.NODE_ENV === 'development' && !redis ? {} : {}),
  });
}
