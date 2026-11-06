import type { Request, Response } from 'express';
import type { LoginInput, SignupInput } from '@pinpoint/shared';
import { updateMeSchema } from '@pinpoint/shared';
import { currentUserId } from '../middleware/auth';
import { authService } from '../services/auth.service';

export const authController = {
  async signup(req: Request, res: Response) {
    const result = await authService.signup(req.body as SignupInput);
    res.status(201).json(result);
  },
  async login(req: Request, res: Response) {
    const result = await authService.login(req.body as LoginInput);
    res.json(result);
  },
  async me(req: Request, res: Response) {
    res.json(await authService.me(currentUserId(req)));
  },
  async updateMe(req: Request, res: Response) {
    const input = updateMeSchema.parse(req.body);
    res.json(await authService.updateMe(currentUserId(req), input));
  },
};
