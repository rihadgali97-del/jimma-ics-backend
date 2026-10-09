import { Router } from 'express';
import * as controller from './students.controller.js';
import { validate } from '../../common/middlewares/validate.js';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { authorize } from '../../common/middlewares/authorize.js';
import {
  createStudentSchema,
  listStudentsSchema,
  studentIdParamSchema,
  updateStudentSchema,
} from './students.validation.js';

export const studentsAdminRouter = Router();

studentsAdminRouter.use(authenticate, authorize('madrasas.write'));
studentsAdminRouter.get('/', validate(listStudentsSchema), controller.list);
studentsAdminRouter.post('/', validate(createStudentSchema), controller.create);
studentsAdminRouter.patch(
  '/:id',
  validate(studentIdParamSchema),
  validate(updateStudentSchema),
  controller.update
);
