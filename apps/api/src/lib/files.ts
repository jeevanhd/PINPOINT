import FileType from 'file-type';
import { PDFDocument } from 'pdf-lib';
import { unsupportedType, unprocessable } from './errors';

export const ALLOWED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedMime = (typeof ALLOWED_MIME)[number];

export interface InspectedFile {
  mimeType: AllowedMime;
  extension: 'pdf' | 'jpg' | 'png' | 'webp';
  pageCount: number;
}

/**
 * Magic-byte validation. The client-supplied mime type is never trusted: we
 * sniff the buffer and reject anything that is not a PDF or an image.
 */
export async function inspectFile(buffer: Buffer): Promise<InspectedFile> {
  if (buffer.length === 0) throw unprocessable('That file is empty');
  const sniffed = await FileType.fromBuffer(buffer);
  const mime = sniffed?.mime;
  if (!mime || !(ALLOWED_MIME as readonly string[]).includes(mime)) {
    throw unsupportedType('Upload a PDF, JPG, PNG or WebP file');
  }
  const mimeType = mime as AllowedMime;
  if (mimeType === 'application/pdf') {
    return { mimeType, extension: 'pdf', pageCount: await countPdfPages(buffer) };
  }
  const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/png' ? 'png' : 'webp';
  return { mimeType, extension, pageCount: 1 };
}

export async function countPdfPages(buffer: Buffer): Promise<number> {
  try {
    const doc = await PDFDocument.load(buffer, { ignoreEncryption: true, updateMetadata: false });
    const pages = doc.getPageCount();
    if (pages < 1) throw unprocessable('That PDF has no pages');
    return pages;
  } catch (err) {
    if (err instanceof Error && err.name === 'AppError') throw err;
    throw unprocessable('That PDF could not be read. Try exporting it again.');
  }
}

/** Pure rule used by the upload endpoint and by the tests. */
export function assertPageBudget(existingPages: number, incomingPages: number, maxPages: number): void {
  if (existingPages + incomingPages > maxPages) {
    throw unprocessable(
      `A topic can hold at most ${maxPages} pages. You already have ${existingPages}.`,
      { code: 'too_many_pages', existingPages, incomingPages, maxPages },
    );
  }
}
