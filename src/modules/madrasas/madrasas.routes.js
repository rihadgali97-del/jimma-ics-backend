import { Router } from 'express';
import * as madrasasController from './madrasas.controller.js';
import {
  listMadrasasSchema,
  madrasaIdParamSchema,
  createMadrasaSchema,
  updateMadrasaSchema,
} from './madrasas.validation.js';
import { validate } from '../../common/middlewares/validate.js';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { authorize } from '../../common/middlewares/authorize.js';
import { directoryImageUpload } from '../../common/middlewares/upload.js';

export const madrasasPublicRouter = Router();
export const madrasasAdminRouter = Router();

/**
 * @openapi
 * /madrasas:
 *   get:
 *     summary: List published madrasas (public directory)
 *     tags: [Madrasas]
 *     parameters:
 *       - in: query
 *         name: woredaId
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: locale
 *         schema: { type: string, enum: [en, am, om, ar] }
 *     responses:
 *       200: { description: Paginated list of published madrasas }
 */
madrasasPublicRouter.get('/', validate(listMadrasasSchema), madrasasController.list);

/**
 * @openapi
 * /madrasas/{id}:
 *   get:
 *     summary: Get a single published madrasa
 *     tags: [Madrasas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: The madrasa }
 *       404: { description: Not found or unpublished }
 */
madrasasPublicRouter.get('/:id', validate(madrasaIdParamSchema), madrasasController.getById);

// --- Admin (content_editor / super_admin) ---
madrasasAdminRouter.use(authenticate, authorize('madrasas.write'));

madrasasAdminRouter.get('/', validate(listMadrasasSchema), madrasasController.adminList);
madrasasAdminRouter.get('/:id', validate(madrasaIdParamSchema), madrasasController.adminGetById);

/**
 * @openapi
 * /admin/madrasas/{id}/photo:
 *   post:
 *     summary: Upload or replace a madrasa photo using Cloudinary
 *     tags: [Admin - Madrasas]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file: { type: string, format: binary }
 *     responses:
 *       200: { description: Cloudinary image URL }
 *       404: { description: Madrasa not found }
 */
madrasasAdminRouter.post(
  '/:id/photo',
  validate(madrasaIdParamSchema),
  directoryImageUpload,
  madrasasController.uploadPhoto
);

/**
 * @openapi
 * /admin/madrasas:
 *   post:
 *     summary: Create a madrasa
 *     tags: [Admin - Madrasas]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [woredaId]
 *             properties:
 *               woredaId: { type: integer }
 *               capacity: { type: integer }
 *               hasBoarding: { type: boolean }
 *               isPublished: { type: boolean }
 *               name:
 *                 type: object
 *                 properties: { en: { type: string }, am: { type: string }, om: { type: string }, ar: { type: string } }
 *     responses:
 *       201: { description: Created }
 */
madrasasAdminRouter.post('/', validate(createMadrasaSchema), madrasasController.create);

/**
 * @openapi
 * /admin/madrasas/{id}:
 *   patch:
 *     summary: Update a madrasa
 *     tags: [Admin - Madrasas]
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
madrasasAdminRouter.patch('/:id', validate(updateMadrasaSchema), madrasasController.update);

/**
 * @openapi
 * /admin/madrasas/{id}:
 *   delete:
 *     summary: Delete a madrasa
 *     tags: [Admin - Madrasas]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204: { description: Deleted }
 *       404: { description: Not found }
 */
madrasasAdminRouter.delete('/:id', validate(madrasaIdParamSchema), madrasasController.remove);