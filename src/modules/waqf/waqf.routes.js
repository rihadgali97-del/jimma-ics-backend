import { Router } from 'express';
import * as waqfController from './waqf.controller.js';
import {
  listWaqfAssetsSchema,
  waqfAssetIdParamSchema,
  createWaqfAssetSchema,
  updateWaqfAssetSchema,
} from './waqf.validation.js';
import { validate } from '../../common/middlewares/validate.js';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { authorize } from '../../common/middlewares/authorize.js';
import { upload } from '../../common/middlewares/upload.js';

export const waqfPublicRouter = Router();
export const waqfAdminRouter = Router();

/**
 * @openapi
 * /transparency/waqf:
 *   get:
 *     summary: List published Waqf assets (public summary — no tenant/income detail)
 *     tags: [Waqf]
 *     parameters:
 *       - in: query
 *         name: woredaId
 *         schema: { type: integer }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [LAND, COMMERCIAL_RENTAL, AGRICULTURAL, CEMETERY] }
 *       - in: query
 *         name: locale
 *         schema: { type: string, enum: [en, am, om, ar] }
 *     responses:
 *       200: { description: Paginated summarized list }
 */
waqfPublicRouter.get('/', validate(listWaqfAssetsSchema), waqfController.list);

/**
 * @openapi
 * /transparency/waqf/{id}:
 *   get:
 *     summary: Get a single published Waqf asset (public summary)
 *     tags: [Waqf]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: The asset (summarized) }
 *       404: { description: Not found or unpublished }
 */
waqfPublicRouter.get('/:id', validate(waqfAssetIdParamSchema), waqfController.getById);

// --- Admin (finance_officer / super_admin) ---
waqfAdminRouter.use(authenticate, authorize('waqf.write'));

waqfAdminRouter.get('/', validate(listWaqfAssetsSchema), waqfController.adminList);
waqfAdminRouter.get('/:id', validate(waqfAssetIdParamSchema), waqfController.adminGetById);
waqfAdminRouter.post('/:id/image', validate(waqfAssetIdParamSchema), upload.single('file'), waqfController.uploadImage);

/**
 * @openapi
 * /admin/waqf:
 *   post:
 *     summary: Register a Waqf asset (full detail, including tenant/income)
 *     tags: [Admin - Waqf]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [woredaId, type]
 *             properties:
 *               woredaId: { type: integer }
 *               type: { type: string, enum: [LAND, COMMERCIAL_RENTAL, AGRICULTURAL, CEMETERY] }
 *               status: { type: string, enum: [ACTIVE, UNDER_MAINTENANCE, DISPUTED, INACTIVE] }
 *               locationNote: { type: string }
 *               monthlyIncome: { type: number }
 *               tenantName: { type: string }
 *               tenantContact: { type: string }
 *               isPublished: { type: boolean }
 *               name:
 *                 type: object
 *                 properties: { en: { type: string }, am: { type: string }, om: { type: string }, ar: { type: string } }
 *     responses:
 *       201: { description: Created }
 */
waqfAdminRouter.post('/', validate(createWaqfAssetSchema), waqfController.create);

/**
 * @openapi
 * /admin/waqf/{id}:
 *   patch:
 *     summary: Update a Waqf asset
 *     tags: [Admin - Waqf]
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
waqfAdminRouter.patch('/:id', validate(updateWaqfAssetSchema), waqfController.update);

/**
 * @openapi
 * /admin/waqf/{id}:
 *   delete:
 *     summary: Delete a Waqf asset
 *     tags: [Admin - Waqf]
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
waqfAdminRouter.delete('/:id', validate(waqfAssetIdParamSchema), waqfController.remove);
