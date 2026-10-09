import { Router } from 'express';
import * as leadershipController from './leadership.controller.js';
import {
  listLeadershipSchema,
  leadershipIdParamSchema,
  createLeadershipSchema,
  updateLeadershipSchema,
} from './leadership.validation.js';
import { validate } from '../../common/middlewares/validate.js';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { authorize } from '../../common/middlewares/authorize.js';

export const leadershipPublicRouter = Router();
export const leadershipAdminRouter = Router();

/**
 * @openapi
 * /leadership:
 *   get:
 *     summary: List published leadership profiles, in display order
 *     tags: [Leadership]
 *     parameters:
 *       - in: query
 *         name: locale
 *         schema: { type: string, enum: [en, am, om, ar] }
 *     responses:
 *       200: { description: Paginated list }
 */
leadershipPublicRouter.get('/', validate(listLeadershipSchema), leadershipController.list);

leadershipPublicRouter.get(
  '/:id',
  validate(leadershipIdParamSchema),
  leadershipController.getById
);

// --- Admin (content_editor / super_admin) ---
leadershipAdminRouter.use(authenticate, authorize('leadership.write'));

leadershipAdminRouter.get('/', validate(listLeadershipSchema), leadershipController.adminList);
leadershipAdminRouter.get(
  '/:id',
  validate(leadershipIdParamSchema),
  leadershipController.adminGetById
);
leadershipAdminRouter.post('/', validate(createLeadershipSchema), leadershipController.create);
leadershipAdminRouter.patch(
  '/:id',
  validate(updateLeadershipSchema),
  leadershipController.update
);
leadershipAdminRouter.delete(
  '/:id',
  validate(leadershipIdParamSchema),
  leadershipController.remove
);