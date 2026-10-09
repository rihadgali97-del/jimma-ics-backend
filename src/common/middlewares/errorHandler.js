import { AppError } from '../errors/AppError.js';
import { logger } from '../utils/logger.js';
import { isProduction } from '../../config/env.js';
import { Prisma } from '@prisma/client';

// Single place that turns any thrown error into the API's error envelope.
// Must be registered LAST, after all routes/middlewares (see app.js).
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const requestId = req.id;

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, requestId }, 'Operational error (5xx)');
    } else {
      logger.warn({ requestId, code: err.code, message: err.message }, 'Handled error');
    }

    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return handlePrismaError(err, req, res);
  }

  // Unexpected/programmer error — never leak internals to the client.
  logger.error({ err, requestId }, 'Unhandled error');
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: isProduction ? 'Something went wrong' : err.message,
    },
  });
}

function handlePrismaError(err, req, res) {
  // P2002: unique constraint violation
  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      error: {
        code: 'CONFLICT',
        message: `A record with this ${err.meta?.target ?? 'value'} already exists`,
      },
    });
  }

  // P2025: record to update/delete not found
  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Resource not found' },
    });
  }

  logger.error({ err, requestId: req.id }, 'Unhandled Prisma error');
  return res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'Database error' },
  });
}