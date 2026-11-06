import { Router } from 'express';
import { z } from 'zod';
import {
  createTopicSchema,
  createUnitSchema,
  explainInputSchema,
  topicIdParamSchema,
  updateTopicSchema,
} from '@pinpoint/shared';
import { topicController } from '../controllers/topic.controller';
import { asyncHandler } from '../lib/asyncHandler';
import { createUserRateLimiter } from '../lib/rateLimit';
import { upload } from '../lib/upload';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';

export const unitRouter = Router();
unitRouter.use(requireAuth);
unitRouter.get('/', asyncHandler(topicController.listUnits));
unitRouter.post('/', validate({ body: createUnitSchema }), asyncHandler(topicController.createUnit));

export const topicRouter = Router();
topicRouter.use(requireAuth);

const uploadLimiter = createUserRateLimiter({ windowMs: 60 * 60 * 1000, max: 40, prefix: 'upload' });
const aiLimiter = createUserRateLimiter({ windowMs: 60 * 60 * 1000, max: 60, prefix: 'explain' });

const fileParamSchema = z.object({ id: z.string().min(1), fileId: z.string().min(1) });

topicRouter.get('/', asyncHandler(topicController.list));
topicRouter.post('/', validate({ body: createTopicSchema }), asyncHandler(topicController.create));
topicRouter.get('/:id', validate({ params: topicIdParamSchema }), asyncHandler(topicController.get));
topicRouter.patch(
  '/:id',
  validate({ params: topicIdParamSchema, body: updateTopicSchema }),
  asyncHandler(topicController.update),
);
topicRouter.delete('/:id', validate({ params: topicIdParamSchema }), asyncHandler(topicController.remove));
topicRouter.post(
  '/:id/files',
  uploadLimiter,
  validate({ params: topicIdParamSchema }),
  upload.single('file'),
  asyncHandler(topicController.addFile),
);
topicRouter.delete(
  '/:id/files/:fileId',
  validate({ params: fileParamSchema }),
  asyncHandler(topicController.removeFile),
);
topicRouter.get(
  '/:id/files/:fileId/job',
  validate({ params: fileParamSchema }),
  asyncHandler(topicController.jobStatus),
);
topicRouter.get('/:id/gaps', validate({ params: topicIdParamSchema }), asyncHandler(topicController.gaps));
topicRouter.get(
  '/:id/explanations',
  validate({ params: topicIdParamSchema }),
  asyncHandler(topicController.explanations),
);
topicRouter.post(
  '/:id/explain',
  aiLimiter,
  validate({ params: topicIdParamSchema, body: explainInputSchema }),
  asyncHandler(topicController.explain),
);
