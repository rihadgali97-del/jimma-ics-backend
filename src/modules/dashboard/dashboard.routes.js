import { Router } from 'express';
import * as dashboardController from './dashboard.controller.js';
import { getDashboardSummarySchema } from './dashboard.validation.js';
import { validate } from '../../common/middlewares/validate.js';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { authorize } from '../../common/middlewares/authorize.js';

export const dashboardRouter = Router();

dashboardRouter.use(authenticate, authorize('dashboard.view'));

/**
 * @openapi
 * /admin/dashboard/summary:
 *   get:
 *     summary: Aggregated admin dashboard statistics (cached ~60s)
 *     tags: [Admin - Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: refresh
 *         schema: { type: string, enum: ['true', 'false'] }
 *         description: Bypass the cache and recompute immediately
 *     responses:
 *       200: { description: Summary stats across applications, directories, events, broadcasts }
 */
dashboardRouter.get(
  '/summary',
  validate(getDashboardSummarySchema),
  dashboardController.getSummary
);