import { Router } from 'express';
import * as usersController from './users.controller.js';
import {
  listUsersSchema,
  createUserSchema,
  updateUserSchema,
  userIdParamSchema,
} from './users.validation.js';
import { validate } from '../../common/middlewares/validate.js';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { authorize } from '../../common/middlewares/authorize.js';
import { upload } from '../../common/middlewares/upload.js';

export const usersRouter = Router();

// Every route here requires a valid staff session and the users.manage
// permission (super_admin always passes, per authorize()).
usersRouter.use(authenticate, authorize('users.manage'));
usersRouter.post('/:id/photo', validate(userIdParamSchema), upload.single('file'), usersController.uploadPhoto);

/**
 * @openapi
 * /admin/users:
 *   get:
 *     summary: List staff accounts
 *     tags: [Admin - Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: roleId
 *         schema: { type: integer }
 *       - in: query
 *         name: isActive
 *         schema: { type: string, enum: ['true', 'false'] }
 *     responses:
 *       200:
 *         description: Paginated list of staff accounts
 */
usersRouter.get('/', validate(listUsersSchema), usersController.list);

/**
 * @openapi
 * /admin/users/{id}:
 *   get:
 *     summary: Get a single staff account
 *     tags: [Admin - Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: The staff account }
 *       404: { description: Not found }
 */
usersRouter.get('/:id', validate(userIdParamSchema), usersController.getById);

/**
 * @openapi
 * /admin/users:
 *   post:
 *     summary: Create a staff account
 *     tags: [Admin - Users]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName, email, password, roleId]
 *             properties:
 *               fullName: { type: string }
 *               email: { type: string, format: email }
 *               phone: { type: string }
 *               password: { type: string, minLength: 10 }
 *               roleId: { type: integer }
 *     responses:
 *       201: { description: Created }
 *       409: { description: Email already in use }
 */
usersRouter.post('/', validate(createUserSchema), usersController.create);

/**
 * @openapi
 * /admin/users/{id}:
 *   patch:
 *     summary: Update a staff account (profile, role, or active status)
 *     tags: [Admin - Users]
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
 *               fullName: { type: string }
 *               phone: { type: string, nullable: true }
 *               roleId: { type: integer }
 *               isActive: { type: boolean }
 *     responses:
 *       200: { description: Updated }
 *       404: { description: Not found }
 */
usersRouter.patch('/:id', validate(updateUserSchema), usersController.update);

/**
 * @openapi
 * /admin/users/{id}:
 *   delete:
 *     summary: Deactivate a staff account (soft delete — revokes all active sessions)
 *     tags: [Admin - Users]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Deactivated }
 *       404: { description: Not found }
 */
usersRouter.delete('/:id', validate(userIdParamSchema), usersController.deactivate);