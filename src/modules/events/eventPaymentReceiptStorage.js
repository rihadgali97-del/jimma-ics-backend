import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import { BadRequestError } from '../../common/errors/httpErrors.js';

const receiptDirectory = path.resolve(env.UPLOAD_DIR, 'private-event-payment-receipts');
const extensionsByMimeType = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['application/pdf', '.pdf'],
]);

export async function saveEventPaymentReceipt(file) {
  if (!file?.buffer?.length) throw new BadRequestError('Please attach a payment receipt');
  const extension = extensionsByMimeType.get(file.mimetype);
  if (!extension) throw new BadRequestError('Payment receipt must be a JPG, PNG, or PDF file');
  const signatureMatches = file.mimetype === 'image/jpeg'
    ? file.buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
    : file.mimetype === 'image/png'
      ? file.buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      : file.buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  if (!signatureMatches) throw new BadRequestError('The uploaded receipt does not match its declared file type');

  await mkdir(receiptDirectory, { recursive: true });
  const filename = `${randomUUID()}${extension}`;
  const filepath = path.join(receiptDirectory, filename);
  await writeFile(filepath, file.buffer, { flag: 'wx' });
  return { filename, mimeType: file.mimetype, filepath };
}

export async function removeEventPaymentReceipt(filepath) {
  await rm(filepath, { force: true });
}

export function getEventPaymentReceiptPath(filename) {
  if (!/^[0-9a-f-]+\.(jpg|png|pdf)$/i.test(filename)) {
    throw new BadRequestError('Invalid payment receipt reference');
  }
  return path.join(receiptDirectory, filename);
}
