import pino from 'pino';
import { env, isProduction, isTest } from './env';

export const logger = pino({
  level: isTest ? 'silent' : env.LOG_LEVEL,
  base: { service: 'pinpoint-api' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      '*.password',
      '*.passwordHash',
      '*.GEMINI_API_KEY',
      '*.JWT_SECRET',
    ],
    censor: '[redacted]',
  },
  transport: isProduction
    ? undefined
    : {
        target: 'pino/file',
        options: { destination: 1 },
      },
});
