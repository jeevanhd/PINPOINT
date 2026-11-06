import { createHash } from 'node:crypto';
import { env } from '../config/env';
import { AppError } from '../lib/errors';
import { buildStorageKey, type PutInput, type StorageDriver } from './index';

interface CloudinaryResponse {
  public_id: string;
  secure_url: string;
}

/**
 * Signed server-side upload. The API secret never reaches the browser, and the
 * resulting URLs are unguessable (random public ids).
 */
export class CloudinaryStorage implements StorageDriver {
  readonly name = 'cloudinary' as const;

  private sign(params: Record<string, string>): string {
    const toSign = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join('&');
    return createHash('sha1').update(`${toSign}${env.CLOUDINARY_API_SECRET}`).digest('hex');
  }

  async put(input: PutInput): Promise<{ key: string; url: string }> {
    const publicId = buildStorageKey('pinpoint', input.extension).replace(/\.[^.]+$/, '');
    const timestamp = String(Math.floor(Date.now() / 1000));
    const folder = 'pinpoint';
    const signature = this.sign({ folder, public_id: publicId, timestamp });

    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(input.buffer)], { type: input.mimeType }), 'upload');
    form.append('api_key', env.CLOUDINARY_API_KEY);
    form.append('timestamp', timestamp);
    form.append('folder', folder);
    form.append('public_id', publicId);
    form.append('signature', signature);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/auto/upload`,
      { method: 'POST', body: form },
    );
    if (!res.ok) {
      const text = await res.text();
      throw new AppError(502, 'internal_error', 'Storage upload failed', text.slice(0, 300));
    }
    const json = (await res.json()) as CloudinaryResponse;
    return { key: json.public_id, url: json.secure_url };
  }

  async read(key: string): Promise<Buffer> {
    const res = await fetch(this.url(key));
    if (!res.ok) throw new AppError(404, 'not_found', 'File is no longer available');
    return Buffer.from(await res.arrayBuffer());
  }

  url(key: string): string {
    return `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/image/upload/${key}`;
  }

  async remove(key: string): Promise<void> {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = this.sign({ public_id: key, timestamp });
    const body = new URLSearchParams({
      public_id: key,
      timestamp,
      api_key: env.CLOUDINARY_API_KEY,
      signature,
    });
    await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/destroy`, {
      method: 'POST',
      body,
    });
  }
}
