import { randomBytes } from 'node:crypto';
import { env } from '../config/env';
import { LocalStorage } from './local';
import { CloudinaryStorage } from './cloudinary';

export interface PutInput {
  buffer: Buffer;
  mimeType: string;
  extension: string;
}

export interface StorageDriver {
  readonly name: 'local' | 'cloudinary';
  put(input: PutInput): Promise<{ key: string; url: string }>;
  read(key: string): Promise<Buffer>;
  url(key: string): string;
  remove(key: string): Promise<void>;
}

let driver: StorageDriver | null = null;

export function getStorage(): StorageDriver {
  if (!driver) {
    driver = env.STORAGE_DRIVER === 'cloudinary' ? new CloudinaryStorage() : new LocalStorage();
  }
  return driver;
}

/** Non-guessable keys: room photos and notes must not be enumerable. */
export function buildStorageKey(prefix: string, extension: string): string {
  return `${prefix}/${Date.now().toString(36)}-${randomBytes(16).toString('hex')}.${extension}`;
}
