import type { Request, Response } from 'express';
import type { CreateFlagInput, UpdateFlagInput } from '@pinpoint/shared';
import { badRequest } from '../lib/errors';
import { currentUserId } from '../middleware/auth';
import { palaceService } from '../services/palace.service';

export const palaceController = {
  async listPlaces(req: Request, res: Response) {
    res.json(await palaceService.listPlaces(currentUserId(req)));
  },
  async createPlace(req: Request, res: Response) {
    if (!req.file) throw badRequest('Attach a photo of the place');
    const name = String(req.body?.name ?? '').trim();
    if (!name) throw badRequest('Give the place a name');
    const place = await palaceService.createPlace(currentUserId(req), name.slice(0, 80), {
      buffer: req.file.buffer,
      originalName: req.file.originalname || 'place',
    });
    res.status(201).json(place);
  },
  async getPlace(req: Request, res: Response) {
    res.json(await palaceService.getPlace(currentUserId(req), req.params.id as string));
  },
  async renamePlace(req: Request, res: Response) {
    const { name } = req.body as { name: string };
    res.json(await palaceService.renamePlace(currentUserId(req), req.params.id as string, name));
  },
  async deletePlace(req: Request, res: Response) {
    await palaceService.deletePlace(currentUserId(req), req.params.id as string);
    res.status(204).end();
  },
  async createFlag(req: Request, res: Response) {
    const flag = await palaceService.createFlag(
      currentUserId(req),
      req.params.id as string,
      req.body as CreateFlagInput,
    );
    res.status(201).json(flag);
  },
  async updateFlag(req: Request, res: Response) {
    res.json(
      await palaceService.updateFlag(currentUserId(req), req.params.id as string, req.body as UpdateFlagInput),
    );
  },
  async deleteFlag(req: Request, res: Response) {
    await palaceService.deleteFlag(currentUserId(req), req.params.id as string);
    res.status(204).end();
  },
};
