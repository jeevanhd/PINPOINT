import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { assertPageBudget, countPdfPages, inspectFile } from '../lib/files';
import { AppError } from '../lib/errors';

async function makePdf(pages: number): Promise<Buffer> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i += 1) doc.addPage([300, 400]);
  return Buffer.from(await doc.save());
}

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/wH+2w8AAAAASUVORK5CYII=',
  'base64',
);

describe('2 page limit', () => {
  it('accepts a two page PDF and counts its pages', async () => {
    const buffer = await makePdf(2);
    const inspected = await inspectFile(buffer);
    expect(inspected.mimeType).toBe('application/pdf');
    expect(inspected.pageCount).toBe(2);
    expect(() => assertPageBudget(0, inspected.pageCount, 2)).not.toThrow();
  });

  it('rejects a third page', async () => {
    const buffer = await makePdf(3);
    const inspected = await inspectFile(buffer);
    expect(inspected.pageCount).toBe(3);
    expect(() => assertPageBudget(0, inspected.pageCount, 2)).toThrowError(/at most 2 pages/);
  });

  it('rejects a second PDF when the topic already holds two pages', () => {
    expect(() => assertPageBudget(2, 1, 2)).toThrowError(AppError);
    expect(() => assertPageBudget(1, 1, 2)).not.toThrow();
  });

  it('counts a photo as one page', async () => {
    const inspected = await inspectFile(PNG_1PX);
    expect(inspected).toMatchObject({ mimeType: 'image/png', pageCount: 1, extension: 'png' });
    expect(() => assertPageBudget(2, 1, 2)).toThrow();
  });

  it('rejects a file that only claims to be a PDF', async () => {
    await expect(inspectFile(Buffer.from('not really a pdf'))).rejects.toThrowError(/Upload a PDF/);
  });

  it('rejects an empty upload', async () => {
    await expect(inspectFile(Buffer.alloc(0))).rejects.toThrowError(/empty/);
  });

  it('reads the page count of a real PDF buffer', async () => {
    await expect(countPdfPages(await makePdf(1))).resolves.toBe(1);
  });
});
