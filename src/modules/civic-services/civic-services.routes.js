import { Router } from 'express';
import * as civicServicesController from './civic-services.controller.js';
import { updateServiceAvailabilitySchema } from './civic-services.validation.js';
import { validate } from '../../common/middlewares/validate.js';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { authorizeAny } from '../../common/middlewares/authorize.js';

export const civicServicesPublicRouter = Router();
export const civicServicesAdminRouter = Router();

/**
 * @openapi
 * /services/availability:
 *   get:
 *     summary: List public civic service availability
 *     tags: [Civic Services]
 *     responses:
 *       200: { description: Availability for each public service }
 */
civicServicesPublicRouter.get('/availability', civicServicesController.listAvailability);

civicServicesAdminRouter.use(authenticate);

/**
 * @openapi
 * /admin/services/availability:
 *   get:
 *     summary: List public civic service availability for administrators
 *     tags: [Admin - Civic Services]
 *     security: [{ bearerAuth: [] }]
 * /admin/services/{serviceKey}/availability:
 *   patch:
 *     summary: Turn a public civic service on or off
 *     tags: [Admin - Civic Services]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: serviceKey
 *         required: true
 *         schema: { type: string, enum: [srv-2, srv-4, srv-5, srv-6, srv-7, srv-8] }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isEnabled]
 *             properties:
 *               isEnabled: { type: boolean }
 *     responses:
 *       200: { description: Updated service availability }
 */
civicServicesAdminRouter.get(
  '/availability',
  authorizeAny('janazah.manage', 'zakat.manage'),
  civicServicesController.listAvailability
);
civicServicesAdminRouter.patch(
  '/:serviceKey/availability',
  authorizeAny('janazah.manage', 'zakat.manage'),
  validate(updateServiceAvailabilitySchema),
  civicServicesController.updateAvailability
);
