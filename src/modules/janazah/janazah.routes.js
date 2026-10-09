import { Router } from 'express';
import * as janazahController from './janazah.controller.js';
import {
  submitJanazahRequestSchema,
  trackJanazahRequestSchema,
  updateJanazahAvailabilitySchema,
  listJanazahRequestsSchema,
  janazahRequestIdParamSchema,
  updateJanazahStatusSchema,
  assignJanazahOfficerSchema,
  listCemeteryPlotsSchema,
  createCemeteryPlotSchema,
  updateCemeteryPlotSchema,
} from './janazah.validation.js';
import { validate } from '../../common/middlewares/validate.js';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { authorize } from '../../common/middlewares/authorize.js';
import { strictRateLimiter } from '../../common/middlewares/rateLimiter.js';

export const janazahPublicRouter = Router();
export const janazahAdminRouter = Router();

// A more generous limit than Zakat/Nikah — this is a 24/7 emergency
// service and a grieving family should never be blocked by rate limiting
// under normal use. Still capped to blunt abuse/spam.
const submitLimiter = strictRateLimiter({ windowMs: 60 * 60 * 1000, max: 20 });
const trackLimiter = strictRateLimiter({ windowMs: 15 * 60 * 1000, max: 30 });

/**
 * @openapi
 * /services/janazah/availability:
 *   get:
 *     summary: Whether public Janazah intake is currently enabled by the council
 *     tags: [Janazah]
 *     responses:
 *       200: { description: Availability flag }
 */
janazahPublicRouter.get('/availability', janazahController.getAvailability);

/**
 * @openapi
 * /services/janazah/requests:
 *   post:
 *     summary: Submit an urgent Janazah (bereavement) request — no login required, 24/7
 *     tags: [Janazah]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [woredaId, deceasedName, contactName, contactPhone]
 *             properties:
 *               woredaId: { type: integer }
 *               deceasedName: { type: string }
 *               contactName: { type: string }
 *               contactPhone: { type: string }
 *               needsGhusl: { type: boolean }
 *               needsTransport: { type: boolean }
 *               needsCemeteryPlot: { type: boolean }
 *               locationNote: { type: string }
 *     responses:
 *       201:
 *         description: Request created — returns a referenceNumber; an on-call officer is paged immediately
 */
janazahPublicRouter.post(
  '/requests',
  submitLimiter,
  validate(submitJanazahRequestSchema),
  janazahController.submit
);

/**
 * @openapi
 * /services/janazah/requests/track/{reference}:
 *   get:
 *     summary: Check a request's status by reference number + phone
 *     tags: [Janazah]
 *     parameters:
 *       - in: path
 *         name: reference
 *         required: true
 *         schema: { type: string, example: JNZ-2026-00017 }
 *       - in: query
 *         name: phone
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Request status }
 *       404: { description: No match for that reference + phone combination }
 */
janazahPublicRouter.get(
  '/requests/track/:reference',
  trackLimiter,
  validate(trackJanazahRequestSchema),
  janazahController.track
);

// --- Admin (case_officer / super_admin) ---
janazahAdminRouter.use(authenticate);

/**
 * @openapi
 * /admin/janazah/availability:
 *   get:
 *     summary: Read Janazah public intake on/off flag
 *     tags: [Admin - Janazah]
 *     security: [{ bearerAuth: [] }]
 *   patch:
 *     summary: Turn Janazah public intake on or off
 *     tags: [Admin - Janazah]
 *     security: [{ bearerAuth: [] }]
 */
janazahAdminRouter.get(
  '/availability',
  authorize('janazah.manage'),
  janazahController.getAdminAvailability
);

janazahAdminRouter.patch(
  '/availability',
  authorize('janazah.manage'),
  validate(updateJanazahAvailabilitySchema),
  janazahController.updateAvailability
);

/**
 * @openapi
 * /admin/janazah/requests:
 *   get:
 *     summary: List Janazah requests (oldest-first — an urgent queue, not a feed)
 *     tags: [Admin - Janazah]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, COMPLETED, CANCELLED] }
 *       - in: query
 *         name: woredaId
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Paginated list, oldest unresolved first }
 */
janazahAdminRouter.get(
  '/requests',
  authorize('janazah.manage'),
  validate(listJanazahRequestsSchema),
  janazahController.list
);

janazahAdminRouter.get(
  '/requests/:id',
  authorize('janazah.manage'),
  validate(janazahRequestIdParamSchema),
  janazahController.getById
);

janazahAdminRouter.patch(
  '/requests/:id/status',
  authorize('janazah.manage'),
  validate(updateJanazahStatusSchema),
  janazahController.updateStatus
);

janazahAdminRouter.patch(
  '/requests/:id/assign',
  authorize('janazah.manage'),
  validate(assignJanazahOfficerSchema),
  janazahController.assignOfficer
);

/**
 * @openapi
 * /admin/janazah/cemetery-plots:
 *   get:
 *     summary: List cemetery plots
 *     tags: [Admin - Janazah]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: woredaId
 *         schema: { type: integer }
 *       - in: query
 *         name: isAvailable
 *         schema: { type: string, enum: ['true', 'false'] }
 *     responses:
 *       200: { description: Paginated list }
 */
janazahAdminRouter.get(
  '/cemetery-plots',
  authorize('cemetery_plots.write'),
  validate(listCemeteryPlotsSchema),
  janazahController.listPlots
);

/**
 * @openapi
 * /admin/janazah/cemetery-plots:
 *   post:
 *     summary: Register a cemetery plot
 *     tags: [Admin - Janazah]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [woredaId, code]
 *             properties:
 *               woredaId: { type: integer }
 *               code: { type: string }
 *               isAvailable: { type: boolean }
 *     responses:
 *       201: { description: Created }
 *       409: { description: Plot code already exists }
 */
janazahAdminRouter.post(
  '/cemetery-plots',
  authorize('cemetery_plots.write'),
  validate(createCemeteryPlotSchema),
  janazahController.createPlot
);

/**
 * @openapi
 * /admin/janazah/cemetery-plots/{id}:
 *   patch:
 *     summary: Update a cemetery plot's availability
 *     tags: [Admin - Janazah]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Updated }
 *       404: { description: Not found }
 */
janazahAdminRouter.patch(
  '/cemetery-plots/:id',
  authorize('cemetery_plots.write'),
  validate(updateCemeteryPlotSchema),
  janazahController.updatePlot
);