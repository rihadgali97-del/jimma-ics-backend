import { Router } from 'express';
import * as mosquesController from './mosques.controller.js';
import {
  listMosquesSchema,
  mosqueIdParamSchema,
  createMosqueSchema,
  updateMosqueSchema,
  upsertPrayerTimesSchema,
} from './mosques.validation.js';
import { validate } from '../../common/middlewares/validate.js';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { authorize } from '../../common/middlewares/authorize.js';
import { directoryImageUpload } from '../../common/middlewares/upload.js';

export const mosquesPublicRouter = Router();
export const mosquesAdminRouter = Router();

/**
 * @openapi
 * /mosques:
 *   get:
 *     summary: List published mosques (public directory)
 *     tags: [Mosques]
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
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Paginated list of published mosques }
 */
mosquesPublicRouter.get('/', validate(listMosquesSchema), mosquesController.list);

/**
 * @openapi
 * /mosques/{id}:
 *   get:
 *     summary: Get a single published mosque
 *     tags: [Mosques]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: The mosque }
 *       404: { description: Not found or unpublished }
 */
mosquesPublicRouter.get('/:id', validate(mosqueIdParamSchema), mosquesController.getById);

// --- Admin (content_editor / super_admin) ---
mosquesAdminRouter.use(authenticate, authorize('mosques.write'));

/**
 * @openapi
 * /admin/mosques:
 *   get:
 *     summary: List all mosques including unpublished (admin)
 *     tags: [Admin - Mosques]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Paginated list }
 */
mosquesAdminRouter.get('/', validate(listMosquesSchema), mosquesController.adminList);

mosquesAdminRouter.get('/:id', validate(mosqueIdParamSchema), mosquesController.adminGetById);

/**
 * @openapi
 * /admin/mosques/{id}/photo:
 *   post:
 *     summary: Upload or replace a mosque photo using Cloudinary
 *     tags: [Admin - Mosques]
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
 *       404: { description: Mosque not found }
 */
mosquesAdminRouter.post(
  '/:id/photo',
  validate(mosqueIdParamSchema),
  directoryImageUpload,
  mosquesController.uploadPhoto
);

/**
 * @openapi
 * /admin/mosques:
 *   post:
 *     summary: Create a mosque
 *     tags: [Admin - Mosques]
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
 *               latitude: { type: number }
 *               longitude: { type: number }
 *               capacity: { type: integer }
 *               hasWuduFacility: { type: boolean }
 *               hasBoarding: { type: boolean }
 *               imamName: { type: string }
 *               isPublished: { type: boolean }
 *               name:
 *                 type: object
 *                 properties: { en: { type: string }, am: { type: string }, om: { type: string }, ar: { type: string } }
 *               description:
 *                 type: object
 *                 properties: { en: { type: string }, am: { type: string }, om: { type: string }, ar: { type: string } }
 *     responses:
 *       201: { description: Created }
 */
mosquesAdminRouter.post('/', validate(createMosqueSchema), mosquesController.create);

/**
 * @openapi
 * /admin/mosques/{id}:
 *   patch:
 *     summary: Update a mosque
 *     tags: [Admin - Mosques]
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
mosquesAdminRouter.patch('/:id', validate(updateMosqueSchema), mosquesController.update);

/**
 * @openapi
 * /admin/mosques/{id}:
 *   delete:
 *     summary: Delete a mosque
 *     tags: [Admin - Mosques]
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
mosquesAdminRouter.delete('/:id', validate(mosqueIdParamSchema), mosquesController.remove);

/**
 * @openapi
 * /admin/mosques/{id}/prayer-times:
 *   put:
 *     summary: Bulk set prayer times for a mosque
 *     tags: [Admin - Mosques]
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
 *             required: [prayerTimes]
 *             properties:
 *               prayerTimes:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     prayerName: { type: string, enum: [fajr, dhuhr, asr, maghrib, isha, jumuah] }
 *                     time: { type: string, example: "05:15" }
 *     responses:
 *       200: { description: Updated mosque with new prayer times }
 *       404: { description: Not found }
 */
mosquesAdminRouter.put(
  '/:id/prayer-times',
  validate(upsertPrayerTimesSchema),
  mosquesController.setPrayerTimes
);