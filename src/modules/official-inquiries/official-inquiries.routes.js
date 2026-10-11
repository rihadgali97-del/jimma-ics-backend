import { Router } from 'express';
import * as officialInquiriesController from './official-inquiries.controller.js';
import {
  submitOfficialInquirySchema,
  listOfficialInquiriesSchema,
  updateOfficialInquiryStatusSchema,
} from './official-inquiries.validation.js';
import { validate } from '../../common/middlewares/validate.js';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { authorize } from '../../common/middlewares/authorize.js';
import { strictRateLimiter } from '../../common/middlewares/rateLimiter.js';

export const officialInquiriesPublicRouter = Router();
export const officialInquiriesAdminRouter = Router();

const submitLimiter = strictRateLimiter({ windowMs: 60 * 60 * 1000, max: 10 });

/**
 * @openapi
 * /official-inquiries:
 *   post:
 *     summary: Submit a public inquiry to a council desk
 *     tags: [Official Inquiries]
 *     responses:
 *       201: { description: Inquiry saved with a reference number }
 */
officialInquiriesPublicRouter.post(
  '/',
  submitLimiter,
  validate(submitOfficialInquirySchema),
  officialInquiriesController.submit
);

officialInquiriesAdminRouter.use(authenticate, authorize('official_inquiries.manage'));

/**
 * @openapi
 * /admin/official-inquiries:
 *   get:
 *     summary: List and search public inquiries
 *     tags: [Admin - Official Inquiries]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Paginated inquiry inbox }
 */
officialInquiriesAdminRouter.get(
  '/',
  validate(listOfficialInquiriesSchema),
  officialInquiriesController.list
);

/**
 * @openapi
 * /admin/official-inquiries/{id}/status:
 *   patch:
 *     summary: Update an inquiry's handling status
 *     tags: [Admin - Official Inquiries]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Updated inquiry }
 */
officialInquiriesAdminRouter.patch(
  '/:id/status',
  validate(updateOfficialInquiryStatusSchema),
  officialInquiriesController.updateStatus
);
