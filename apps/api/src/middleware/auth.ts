import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../lib/jwt';
import { unauthorized } from '../lib/errors';

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    next(unauthorized('Missing bearer token'));
    return;
  }
  const payload = verifyAccessToken(token);
  req.user = { id: payload.sub };
  next();
}

/** The only sanctioned way to read the current user id inside a handler. */
export function currentUserId(req: Request): string {
  if (!req.user?.id) throw unauthorized();
  return req.user.id;
}
