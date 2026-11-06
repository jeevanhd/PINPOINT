import { Router } from 'express';
import { z } from 'zod';
import {
  createFlagSchema,
  flagIdParamSchema,
  placeIdParamSchema,
  updateFlagSchema,
  updatePlaceSchema,
} from '@pinpoint/shared';
import { palaceController } from '../controllers/palace.controller';
import { asyncHandler } from '../lib/asyncHandler';
import { createUserRateLimiter } from '../lib/rateLimit';
import { upload } from '../lib/upload';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';

export const placeRouter = Router();
placeRouter.use(requireAuth);

const uploadLimiter = createUserRateLimiter({ windowMs: 60 * 60 * 1000, max: 40, prefix: 'place' });

placeRouter.get('/', asyncHandler(palaceController.listPlaces));
placeRouter.post('/', uploadLimiter, upload.single('file'), asyncHandler(palaceController.createPlace));
placeRouter.get('/:id', validate({ params: placeIdParamSchema }), asyncHandler(palaceController.getPlace));
placeRouter.patch(
  '/:id',
  validate({ params: placeIdParamSchema, body: updatePlaceSchema }),
  asyncHandler(palaceController.renamePlace),
);
placeRouter.delete(
  '/:id',
  validate({ params: placeIdParamSchema }),
  asyncHandler(palaceController.deletePlace),
);
placeRouter.post(
  '/:id/flags',
  validate({ params: placeIdParamSchema, body: createFlagSchema }),
  asyncHandler(palaceController.createFlag),
);

export const flagRouter = Router();
flagRouter.use(requireAuth);
const flagIdParams = z.object({ id: z.string().min(1) });
flagRouter.patch(
  '/:id',
  validate({ params: flagIdParams, body: updateFlagSchema }),
  asyncHandler(palaceController.updateFlag),
);
flagRouter.delete(
  '/:id',
  validate({ params: flagIdParams }),
  asyncHandler(palaceController.deleteFlag),
);

export { flagIdParamSchema };
