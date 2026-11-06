import { Router } from 'express';
import { loginSchema, signupSchema, updateMeSchema } from '@pinpoint/shared';
import { authController } from '../controllers/auth.controller';
import { asyncHandler } from '../lib/asyncHandler';
import { createUserRateLimiter } from '../lib/rateLimit';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';

export const authRouter = Router();

const authLimiter = createUserRateLimiter({ windowMs: 15 * 60 * 1000, max: 40, prefix: 'auth' });

authRouter.post('/signup', authLimiter, validate({ body: signupSchema }), asyncHandler(authController.signup));
authRouter.post('/login', authLimiter, validate({ body: loginSchema }), asyncHandler(authController.login));
authRouter.get('/me', requireAuth, asyncHandler(authController.me));
authRouter.patch(
  '/me',
  requireAuth,
  validate({ body: updateMeSchema }),
  asyncHandler(authController.updateMe),
);
