import { Router } from 'express';
import * as controller from './teachers.controller.js';
import { validate } from '../../common/middlewares/validate.js';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { authorize } from '../../common/middlewares/authorize.js';
import {
  createTeacherSchema,
  listTeachersSchema,
  teacherIdParamSchema,
  updateTeacherSchema,
} from './teachers.validation.js';

export const teachersPublicRouter = Router();
export const teachersAdminRouter = Router();

teachersPublicRouter.get('/', validate(listTeachersSchema), controller.listPublic);
teachersPublicRouter.get('/:id', validate(teacherIdParamSchema), controller.getPublic);

teachersAdminRouter.use(authenticate, authorize('madrasas.write'));
teachersAdminRouter.get('/', validate(listTeachersSchema), controller.listAdmin);
teachersAdminRouter.get('/:id', validate(teacherIdParamSchema), controller.getAdmin);
teachersAdminRouter.post('/', validate(createTeacherSchema), controller.create);
teachersAdminRouter.patch('/:id', validate(updateTeacherSchema), controller.update);
teachersAdminRouter.delete('/:id', validate(teacherIdParamSchema), controller.remove);
