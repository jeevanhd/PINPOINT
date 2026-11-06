export type ErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'payload_too_large'
  | 'unsupported_media_type'
  | 'too_many_requests'
  | 'validation_failed'
  | 'internal_error';

export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'bad_request', message, details);
export const unauthorized = (message = 'Sign in to continue') =>
  new AppError(401, 'unauthorized', message);
export const forbidden = (message = 'Not allowed') => new AppError(403, 'forbidden', message);
export const notFound = (message = 'Not found') => new AppError(404, 'not_found', message);
export const conflict = (message: string) => new AppError(409, 'conflict', message);
export const tooLarge = (message: string) => new AppError(413, 'payload_too_large', message);
export const unsupportedType = (message: string) =>
  new AppError(415, 'unsupported_media_type', message);
export const unprocessable = (message: string, details?: unknown) =>
  new AppError(422, 'validation_failed', message, details);
