import { Router } from 'express';
import * as controller from './ulema.controller.js';
import { validate } from '../../common/middlewares/validate.js';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { authorize } from '../../common/middlewares/authorize.js';
import { upload } from '../../common/middlewares/upload.js';
import {
  createUlemaSchema,
  listUlemaSchema,
  ulemaIdParamSchema,
  updateUlemaSchema,
} from './ulema.validation.js';

export const ulemaPublicRouter = Router();
export const ulemaAdminRouter = Router();

ulemaPublicRouter.get('/', validate(listUlemaSchema), controller.listPublic);
ulemaPublicRouter.get('/:id', validate(ulemaIdParamSchema), controller.getPublic);

ulemaAdminRouter.use(authenticate, authorize('fatwas.write'));
ulemaAdminRouter.get('/', validate(listUlemaSchema), controller.listAdmin);
ulemaAdminRouter.get('/:id', validate(ulemaIdParamSchema), controller.getAdmin);
ulemaAdminRouter.post('/', validate(createUlemaSchema), controller.create);
ulemaAdminRouter.patch('/:id', validate(updateUlemaSchema), controller.update);
ulemaAdminRouter.post('/:id/avatar', validate(ulemaIdParamSchema), upload.single('file'), controller.uploadAvatar);
ulemaAdminRouter.delete('/:id', validate(ulemaIdParamSchema), controller.remove);
