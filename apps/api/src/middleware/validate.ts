import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import { AppError } from '../lib/errors';

interface Schemas {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
}

/** Validates and replaces req.body / req.params / req.query with parsed values. */
export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.params) req.params = schemas.params.parse(req.params);
      if (schemas.query) req.query = schemas.query.parse(req.query);
      if (schemas.body) req.body = schemas.body.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(
          new AppError(
            422,
            'validation_failed',
            'Some fields need attention',
            err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
          ),
        );
        return;
      }
      next(err);
    }
  };
}
