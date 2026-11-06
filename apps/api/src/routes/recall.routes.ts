import { Router } from 'express';
import { z } from 'zod';
import { recallResultSchema, startRecallSchema } from '@pinpoint/shared';
import { recallController } from '../controllers/recall.controller';
import { asyncHandler } from '../lib/asyncHandler';
import { createUserRateLimiter } from '../lib/rateLimit';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';

export const recallRouter = Router();
recallRouter.use(requireAuth);

const roundParams = z.object({ roundId: z.string().min(1) });
const startLimiter = createUserRateLimiter({ windowMs: 60 * 60 * 1000, max: 60, prefix: 'recall' });

recallRouter.post('/start', startLimiter, validate({ body: startRecallSchema }), asyncHandler(recallController.start));
recallRouter.get('/:roundId', validate({ params: roundParams }), asyncHandler(recallController.get));
recallRouter.post(
  '/:roundId/result',
  validate({ params: roundParams, body: recallResultSchema }),
  asyncHandler(recallController.result),
);
recallRouter.post(
  '/:roundId/finish',
  validate({ params: roundParams }),
  asyncHandler(recallController.finish),
);
