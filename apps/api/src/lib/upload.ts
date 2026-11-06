import multer from 'multer';
import { env } from '../config/env';

/** Buffers stay in memory: we validate magic bytes before anything touches disk. */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.MAX_UPLOAD_MB * 1024 * 1024,
    files: 1,
  },
});
