import { Router } from 'express';
import * as woredasController from './woredas.controller.js';
import {
  listWoredasSchema,
  woredaIdParamSchema,
  createWoredaSchema,
  updateWoredaSchema,
} from './woredas.validation.js';
import { validate } from '../../common/middlewares/validate.js';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { authorize } from '../../common/middlewares/authorize.js';

export const woredasRouter = Router();

/**
 * @openapi
 * /locations/woredas:
 *   get:
 *     summary: List the Jimma Zone Woredas (used as a filter dropdown throughout the app)
 *     tags: [Locations]
 *     parameters:
 *       - in: query
 *         name: locale
 *         schema: { type: string, enum: [en, am, om, ar] }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Paginated list of woredas }
 */
woredasRouter.get('/', validate(listWoredasSchema), woredasController.list);

/**
 * @openapi
 * /locations/woredas/admin:
 *   get:
 *     summary: List all Woredas, including inactive records
 *     tags: [Locations]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Paginated administrative list of Woredas }
 *       401: { description: Authentication required }
 *       403: { description: Missing permission }
 */
woredasRouter.get(
  '/admin',
  authenticate,
  authorize('woredas.write'),
  validate(listWoredasSchema),
  woredasController.listAdmin
);

woredasRouter.get('/gis', validate(listWoredasSchema), woredasController.listGis);

/**
 * @openapi
 * /locations/woredas/{id}:
 *   get:
 *     summary: Get a single woreda
 *     tags: [Locations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: locale
 *         schema: { type: string, enum: [en, am, om, ar] }
 *     responses:
 *       200: { description: The woreda }
 *       404: { description: Not found }
 */
woredasRouter.get('/:id', validate(woredaIdParamSchema), woredasController.getById);

/**
 * @openapi
 * /locations/woredas:
 *   post:
 *     summary: Create a woreda
 *     tags: [Locations]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code: { type: string, example: agaro }
 *               name:
 *                 type: object
 *                 properties:
 *                   en: { type: string }
 *                   am: { type: string }
 *                   om: { type: string }
 *                   ar: { type: string }
 *     responses:
 *       201: { description: Created }
 *       409: { description: Code already exists }
 */
woredasRouter.post(
  '/',
  authenticate,
  authorize('woredas.write'),
  validate(createWoredaSchema),
  woredasController.create
);

/**
 * @openapi
 * /locations/woredas/{id}:
 *   patch:
 *     summary: Update a Woreda's translated name or public availability
 *     tags: [Locations]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: object }
 *               isActive: { type: boolean }
 *     responses:
 *       200: { description: Updated }
 *       404: { description: Not found }
 */
woredasRouter.patch(
  '/:id',
  authenticate,
  authorize('woredas.write'),
  validate(updateWoredaSchema),
  woredasController.update
);