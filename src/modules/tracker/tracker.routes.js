import { Router } from 'express';
import * as trackerController from './tracker.controller.js';
import { trackSchema } from './tracker.validation.js';
import { validate } from '../../common/middlewares/validate.js';
import { strictRateLimiter } from '../../common/middlewares/rateLimiter.js';

export const trackerRouter = Router();

const trackLimiter = strictRateLimiter({ windowMs: 15 * 60 * 1000, max: 30 });

/**
 * @openapi
 * /track/{reference}:
 *   get:
 *     summary: Track any application/request by its reference number, regardless of service
 *     description: >
 *       Resolves the reference number's prefix (ZKT for Zakat, JNZ for Janazah)
 *       and returns that service's status view. A single tracker endpoint for
 *       the whole site instead of one per service.
 *     tags: [Tracker]
 *     parameters:
 *       - in: path
 *         name: reference
 *         required: true
 *         schema: { type: string, example: ZKT-2026-00042 }
 *       - in: query
 *         name: phone
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Status, tagged with which service it belongs to }
 *       400: { description: Reference number format not recognized }
 *       404: { description: No match for that reference + phone combination }
 */
trackerRouter.get('/:reference', trackLimiter, validate(trackSchema), trackerController.track);