import { promises as fs } from 'node:fs';
import path from 'node:path';
import { env } from '../config/env';
import { notFound } from '../lib/errors';
import { buildStorageKey, type PutInput, type StorageDriver } from './index';

export class LocalStorage implements StorageDriver {
  readonly name = 'local' as const;

  private root(): string {
    return path.resolve(process.cwd(), env.LOCAL_STORAGE_DIR);
  }

  private resolveKey(key: string): string {
    const root = this.root();
    const target = path.resolve(root, key);
    if (!target.startsWith(root)) throw notFound('File not found');
    return target;
  }

  async put(input: PutInput): Promise<{ key: string; url: string }> {
    const key = buildStorageKey('uploads', input.extension);
    const target = this.resolveKey(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, input.buffer);
    return { key, url: this.url(key) };
  }

  async read(key: string): Promise<Buffer> {
    try {
      return await fs.readFile(this.resolveKey(key));
    } catch {
      throw notFound('File is no longer available');
    }
  }

  url(key: string): string {
    return `${env.PUBLIC_API_URL.replace(/\/$/, '')}/api/files/${key}`;
  }

  async remove(key: string): Promise<void> {
    await fs.rm(this.resolveKey(key), { force: true });
  }
}
