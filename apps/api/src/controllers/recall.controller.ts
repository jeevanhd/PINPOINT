import type { Request, Response } from 'express';
import type { RecallResultInput, StartRecallInput } from '@pinpoint/shared';
import { currentUserId } from '../middleware/auth';
import { recallService } from '../services/recall.service';

export const recallController = {
  async start(req: Request, res: Response) {
    res.status(201).json(await recallService.start(currentUserId(req), req.body as StartRecallInput));
  },
  async get(req: Request, res: Response) {
    res.json(await recallService.getRound(currentUserId(req), req.params.roundId as string));
  },
  async result(req: Request, res: Response) {
    res.json(
      await recallService.submitResult(
        currentUserId(req),
        req.params.roundId as string,
        req.body as RecallResultInput,
      ),
    );
  },
  async finish(req: Request, res: Response) {
    res.json(await recallService.finish(currentUserId(req), req.params.roundId as string));
  },
};
