import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import { AppError } from '../lib/errors';
import { logger } from '../config/logger';
import type { ApiError } from '@pinpoint/shared';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(404, 'not_found', `No route for ${req.method} ${req.path}`));
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  let status = 500;
  let code = 'internal_error';
  let message = 'Something went wrong on our side';
  let details: unknown;

  if (err instanceof AppError) {
    status = err.status;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    status = 422;
    code = 'validation_failed';
    message = 'Some fields need attention';
    details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  } else if (err instanceof multer.MulterError) {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    code = err.code === 'LIMIT_FILE_SIZE' ? 'payload_too_large' : 'bad_request';
    message = err.code === 'LIMIT_FILE_SIZE' ? 'That file is too large' : err.message;
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      status = 409;
      code = 'conflict';
      message = 'That already exists';
    } else if (err.code === 'P2025') {
      status = 404;
      code = 'not_found';
      message = 'Not found';
    }
  }

  if (status >= 500) {
    logger.error({ err, requestId: req.requestId, path: req.path }, 'unhandled error');
  } else {
    logger.warn({ requestId: req.requestId, path: req.path, code, status }, message);
  }

  const body: ApiError = {
    error: { code, message, ...(details !== undefined ? { details } : {}) },
  };
  res.status(status).json(body);
}
