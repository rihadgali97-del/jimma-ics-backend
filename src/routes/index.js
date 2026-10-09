import { Router } from 'express';
import { sendSuccess } from '../common/utils/apiResponse.js';
import { authRouter } from '../modules/auth/auth.routes.js';
import { usersRouter } from '../modules/users/users.routes.js';
import { rolesRouter } from '../modules/roles/role.routes.js';
import { auditRouter } from '../modules/users/audit.routes.js';
import { woredasRouter } from '../modules/woredas/woredas.routes.js';
import { mosquesPublicRouter, mosquesAdminRouter } from '../modules/mosques/mosques.routes.js';
import { madrasasPublicRouter, madrasasAdminRouter } from '../modules/madrasas/madrasas.routes.js';
import { documentsRouter } from '../modules/documents/documents.routes.js';
import { zakatPublicRouter, zakatAdminRouter, zakatAccountRouter } from '../modules/zakat/zakat.routes.js';
import { janazahPublicRouter, janazahAdminRouter } from '../modules/janazah/janazah.routes.js';
import {
  civicServicesPublicRouter,
  civicServicesAdminRouter,
} from '../modules/civic-services/civic-services.routes.js';
import { trackerRouter } from '../modules/tracker/tracker.routes.js';
import { waqfPublicRouter, waqfAdminRouter } from '../modules/waqf/waqf.routes.js';
import { financePublicRouter, financeAdminRouter } from '../modules/finance/finance.routes.js';
import { announcementsPublicRouter, announcementsAdminRouter } from '../modules/announcements/announcements.routes.js';
import { eventsPublicRouter, eventsAdminRouter } from '../modules/events/events.routes.js';
import { fatwasPublicRouter, fatwasAdminRouter } from '../modules/fatwas/fatwas.routes.js';
import {
  leadershipPublicRouter,
  leadershipAdminRouter,
} from '../modules/leadership/leadership.routes.js';
import { dashboardRouter } from '../modules/dashboard/dashboard.routes.js';
import { donationsPublicRouter, donationsAdminRouter } from '../modules/donations/donations.routes.js';
import { teachersPublicRouter, teachersAdminRouter } from '../modules/teachers/teachers.routes.js';
import { studentsAdminRouter } from '../modules/students/students.routes.js';
import { ulemaPublicRouter, ulemaAdminRouter } from '../modules/ulema/ulema.routes.js';
import {
  notificationsPublicRouter,
  notificationsAdminRouter,
} from '../modules/notifications/notifications.routes.js';
import { systemSettingsAdminRouter } from '../modules/system-settings/system-settings.routes.js';

export const apiRouter = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Liveness/readiness probe
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Service is up
 */
apiRouter.get('/health', (req, res) => {
  sendSuccess(res, { data: { status: 'ok', timestamp: new Date().toISOString() } });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/admin/users', usersRouter);
apiRouter.use('/admin/roles', rolesRouter);
apiRouter.use('/admin/audit-logs', auditRouter);
apiRouter.use('/locations/woredas', woredasRouter);
apiRouter.use('/mosques', mosquesPublicRouter);
apiRouter.use('/admin/mosques', mosquesAdminRouter);
apiRouter.use('/madrasas', madrasasPublicRouter);
apiRouter.use('/admin/madrasas', madrasasAdminRouter);
apiRouter.use('/teachers', teachersPublicRouter);
apiRouter.use('/admin/teachers', teachersAdminRouter);
apiRouter.use('/admin/students', studentsAdminRouter);
apiRouter.use('/ulema', ulemaPublicRouter);
apiRouter.use('/admin/ulema', ulemaAdminRouter);
apiRouter.use('/documents', documentsRouter);
apiRouter.use('/donations/intents', donationsPublicRouter);
apiRouter.use('/admin/donations', donationsAdminRouter);
apiRouter.use('/services/zakat', zakatPublicRouter);
apiRouter.use('/account/zakat', zakatAccountRouter);
apiRouter.use('/admin/zakat', zakatAdminRouter);
apiRouter.use('/zakat', zakatPublicRouter); // exposes /zakat/rates at the shorter public path too
apiRouter.use('/services/janazah', janazahPublicRouter);
apiRouter.use('/admin/janazah', janazahAdminRouter);
apiRouter.use('/services', civicServicesPublicRouter);
apiRouter.use('/admin/services', civicServicesAdminRouter);
apiRouter.use('/track', trackerRouter);
apiRouter.use('/transparency/waqf', waqfPublicRouter);
apiRouter.use('/admin/waqf', waqfAdminRouter);
apiRouter.use('/transparency/financial-reports', financePublicRouter);
apiRouter.use('/admin/finance/reports', financeAdminRouter);
apiRouter.use('/announcements', announcementsPublicRouter);
apiRouter.use('/admin/announcements', announcementsAdminRouter);
apiRouter.use('/events', eventsPublicRouter);
apiRouter.use('/admin/events', eventsAdminRouter);
//apiRouter.use('/admin/events', eventsAdminRouter);
apiRouter.use('/notifications', notificationsPublicRouter);
apiRouter.use('/admin/notifications', notificationsAdminRouter);
apiRouter.use('/admin/system-settings', systemSettingsAdminRouter);
apiRouter.use('/fatwas', fatwasPublicRouter);
apiRouter.use('/admin/fatwas', fatwasAdminRouter);
apiRouter.use('/leadership', leadershipPublicRouter);
apiRouter.use('/admin/leadership', leadershipAdminRouter);
apiRouter.use('/admin/dashboard', dashboardRouter);

// Further hardening is done in Phase 8: audit-log coverage review, Swagger
// completeness pass, and rate-limit tuning on remaining public endpoints.
