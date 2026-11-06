import type { Request, Response } from 'express';
import type { CreateTopicInput, ExplainInput, UpdateTopicInput } from '@pinpoint/shared';
import { badRequest } from '../lib/errors';
import { currentUserId } from '../middleware/auth';
import { explainService } from '../services/explain.service';
import { topicService } from '../services/topic.service';

export const topicController = {
  async listUnits(req: Request, res: Response) {
    res.json(await topicService.listUnits(currentUserId(req)));
  },
  async createUnit(req: Request, res: Response) {
    const { title } = req.body as { title: string };
    res.status(201).json(await topicService.createUnit(currentUserId(req), title));
  },
  async list(req: Request, res: Response) {
    res.json(await topicService.listTopics(currentUserId(req)));
  },
  async create(req: Request, res: Response) {
    res.status(201).json(await topicService.createTopic(currentUserId(req), req.body as CreateTopicInput));
  },
  async get(req: Request, res: Response) {
    res.json(await topicService.getTopic(currentUserId(req), req.params.id as string));
  },
  async update(req: Request, res: Response) {
    res.json(
      await topicService.updateTopic(
        currentUserId(req),
        req.params.id as string,
        req.body as UpdateTopicInput,
      ),
    );
  },
  async remove(req: Request, res: Response) {
    await topicService.deleteTopic(currentUserId(req), req.params.id as string);
    res.status(204).end();
  },
  async addFile(req: Request, res: Response) {
    if (!req.file) throw badRequest('Attach a PDF or a photo');
    const result = await topicService.addFile(currentUserId(req), req.params.id as string, {
      buffer: req.file.buffer,
      originalName: req.file.originalname || 'upload',
    });
    res.status(202).json(result);
  },
  async removeFile(req: Request, res: Response) {
    await topicService.deleteFile(
      currentUserId(req),
      req.params.id as string,
      req.params.fileId as string,
    );
    res.status(204).end();
  },
  async jobStatus(req: Request, res: Response) {
    res.json(
      await topicService.jobStatus(
        currentUserId(req),
        req.params.id as string,
        req.params.fileId as string,
      ),
    );
  },
  async gaps(req: Request, res: Response) {
    res.json(await topicService.gapsForTopic(currentUserId(req), req.params.id as string));
  },
  async explain(req: Request, res: Response) {
    const result = await explainService.explain(
      currentUserId(req),
      req.params.id as string,
      req.body as ExplainInput,
    );
    res.status(201).json(result);
  },
  async explanations(req: Request, res: Response) {
    res.json(await explainService.listForTopic(currentUserId(req), req.params.id as string));
  },
};
