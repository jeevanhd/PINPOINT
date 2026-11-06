import type { Request, Response } from 'express';
import { notFound } from '../lib/errors';
import { env } from '../config/env';
import { getStorage } from '../storage';

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

/** Serves locally stored uploads under a non-guessable key. */
export const fileController = {
  async serve(req: Request, res: Response) {
    const key = (req.params as { 0?: string })[0];
    if (!key) throw notFound('File not found');
    if (env.STORAGE_DRIVER !== 'local') throw notFound('Files are served by the storage provider');
    const buffer = await getStorage().read(key);
    const ext = key.split('.').pop() ?? '';
    res.setHeader('content-type', MIME_BY_EXT[ext] ?? 'application/octet-stream');
    res.setHeader('cache-control', 'private, max-age=3600');
    res.send(buffer);
  },
};
