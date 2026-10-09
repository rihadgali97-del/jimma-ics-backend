import { Router } from 'express';
import * as fatwasController from './fatwas.controller.js';
import {
  listFatwasSchema,
  fatwaIdParamSchema,
  createFatwaSchema,
  updateFatwaSchema,
} from './fatwas.validation.js';
import { validate } from '../../common/middlewares/validate.js';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { authorize } from '../../common/middlewares/authorize.js';

export const fatwasPublicRouter = Router();
export const fatwasAdminRouter = Router();

/**
 * @openapi
 * /fatwas:
 *   get:
 *     summary: List/search published fatwas
 *     tags: [Fatwas]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: locale
 *         schema: { type: string, enum: [en, am, om, ar] }
 *     responses:
 *       200: { description: Paginated list, newest first }
 */
fatwasPublicRouter.get('/', validate(listFatwasSchema), fatwasController.list);

fatwasPublicRouter.get('/:id', validate(fatwaIdParamSchema), fatwasController.getById);

// --- Admin (content_editor / super_admin) ---
fatwasAdminRouter.use(authenticate, authorize('fatwas.write'));

fatwasAdminRouter.get('/', validate(listFatwasSchema), fatwasController.adminList);
fatwasAdminRouter.get('/:id', validate(fatwaIdParamSchema), fatwasController.adminGetById);
fatwasAdminRouter.post('/', validate(createFatwaSchema), fatwasController.create);
fatwasAdminRouter.patch('/:id', validate(updateFatwaSchema), fatwasController.update);
fatwasAdminRouter.delete('/:id', validate(fatwaIdParamSchema), fatwasController.remove);