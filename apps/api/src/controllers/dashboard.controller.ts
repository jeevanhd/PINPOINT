import type { Request, Response } from 'express';
import type { CreateExamInput } from '@pinpoint/shared';
import { currentUserId } from '../middleware/auth';
import { dashboardService } from '../services/dashboard.service';

export const dashboardController = {
  async get(req: Request, res: Response) {
    res.json(await dashboardService.get(currentUserId(req)));
  },
  async listExams(req: Request, res: Response) {
    res.json(await dashboardService.listExams(currentUserId(req)));
  },
  async createExam(req: Request, res: Response) {
    res.status(201).json(await dashboardService.createExam(currentUserId(req), req.body as CreateExamInput));
  },
  async deleteExam(req: Request, res: Response) {
    await dashboardService.deleteExam(currentUserId(req), req.params.id as string);
    res.status(204).end();
  },
};
