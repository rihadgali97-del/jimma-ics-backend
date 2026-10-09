import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { env } from '../../config/env.js';
import { BadRequestError } from '../errors/httpErrors.js';

// Only formats actually needed by the modules planned in the requirements
// doc: photos (mosques/madrasas/leadership) and documents (IDs, deeds,
// certificates, audited PDF reports).
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, env.UPLOAD_DIR);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${randomUUID()}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024 },
  fileFilter(req, file, cb) {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new BadRequestError(`Unsupported file type: ${file.mimetype}`));
    }
    cb(null, true);
  },
});

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return cb(new BadRequestError(`Unsupported image type: ${file.mimetype}`));
    }
    cb(null, true);
  },
});

const eventPaymentReceiptUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    if (!['image/jpeg', 'image/png', 'application/pdf'].includes(file.mimetype)) {
      return cb(new BadRequestError('Payment receipt must be a JPG, PNG, or PDF file'));
    }
    cb(null, true);
  },
}).single('receipt');

export function eventPaymentReceiptUpload(req, res, next) {
  eventPaymentReceiptUploadMiddleware(req, res, (error) => {
    if (error?.code === 'LIMIT_FILE_SIZE') {
      return next(new BadRequestError(`Payment receipt exceeds the ${env.MAX_UPLOAD_SIZE_MB} MB upload limit`));
    }
    if (error?.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(new BadRequestError('Upload one payment receipt using the "receipt" field'));
    }
    if (error) return next(error);
    return next();
  });
}

const directoryImageUploadMiddleware = imageUpload.single('file');

export function directoryImageUpload(req, res, next) {
  directoryImageUploadMiddleware(req, res, (error) => {
    if (error?.code === 'LIMIT_FILE_SIZE') {
      return next(new BadRequestError(`Image exceeds the ${env.MAX_UPLOAD_SIZE_MB} MB upload limit`));
    }
    if (error?.code === 'LIMIT_UNEXPECTED_FILE') {
      return next(new BadRequestError('Upload one image using the "file" field'));
    }
    if (error) return next(error);
    return next();
  });
}

const councilDocumentUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024 },
}).single('file');

export function councilDocumentUpload(req, res, next) {
  councilDocumentUploadMiddleware(req, res, (error) => {
    if (error?.code === 'LIMIT_FILE_SIZE') {
      return next(new BadRequestError(`Document exceeds the ${env.MAX_UPLOAD_SIZE_MB} MB upload limit`));
    }
    if (error) return next(error);
    return next();
  });
}