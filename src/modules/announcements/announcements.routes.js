import { Router } from 'express';
import * as announcementsController from './announcements.controller.js';
import {
  announcementIdSchema,
  createAnnouncementSchema,
  listAnnouncementsSchema,
  updateAnnouncementSchema,
} from './announcements.validation.js';
import { validate } from '../../common/middlewares/validate.js';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { authorize } from '../../common/middlewares/authorize.js';
import { upload } from '../../common/middlewares/upload.js';

export const announcementsPublicRouter = Router();
export const announcementsAdminRouter = Router();

announcementsPublicRouter.get('/', validate(listAnnouncementsSchema), announcementsController.listPublic);
announcementsPublicRouter.get('/:id', validate(announcementIdSchema), announcementsController.getPublic);

announcementsAdminRouter.use(authenticate, authorize('announcements.write'));
announcementsAdminRouter.get('/', validate(listAnnouncementsSchema), announcementsController.listAdmin);
announcementsAdminRouter.post('/', validate(createAnnouncementSchema), announcementsController.create);
announcementsAdminRouter.post('/:id/banner', validate(announcementIdSchema), upload.single('file'), announcementsController.uploadBanner);
announcementsAdminRouter.patch('/:id', validate(updateAnnouncementSchema), announcementsController.update);
announcementsAdminRouter.delete('/:id', validate(announcementIdSchema), announcementsController.remove);
