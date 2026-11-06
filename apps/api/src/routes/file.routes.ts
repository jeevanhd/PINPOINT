import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler';
import { fileController } from '../controllers/file.controller';

export const fileRouter = Router();
fileRouter.get('/*', asyncHandler(fileController.serve));
