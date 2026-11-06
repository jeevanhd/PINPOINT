import type { NextFunction, Request, RequestHandler, Response } from 'express';

type Handler = (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown;

/** Wraps an async controller so rejected promises reach the central error handler. */
export const asyncHandler =
  (fn: Handler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
