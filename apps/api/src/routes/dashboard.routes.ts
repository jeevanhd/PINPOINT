import { Router } from 'express';
import { z } from 'zod';
import { createExamSchema } from '@pinpoint/shared';
import { dashboardController } from '../controllers/dashboard.controller';
import { asyncHandler } from '../lib/asyncHandler';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);
dashboardRouter.get('/', asyncHandler(dashboardController.get));

export const examRouter = Router();
examRouter.use(requireAuth);
const examParams = z.object({ id: z.string().min(1) });
examRouter.get('/', asyncHandler(dashboardController.listExams));
examRouter.post('/', validate({ body: createExamSchema }), asyncHandler(dashboardController.createExam));
examRouter.delete('/:id', validate({ params: examParams }), asyncHandler(dashboardController.deleteExam));
