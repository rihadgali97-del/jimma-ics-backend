import { Router } from 'express';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { requireRole } from '../../common/middlewares/authorize.js';
import { getStatus } from './system-settings.controller.js';

export const systemSettingsAdminRouter = Router();

systemSettingsAdminRouter.use(authenticate, requireRole('super_admin'));
systemSettingsAdminRouter.get('/status', getStatus);
