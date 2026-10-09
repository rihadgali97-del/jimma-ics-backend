import { Router } from 'express';
import * as zakatController from './zakat.controller.js';
import {
  submitZakatApplicationSchema,
  trackZakatApplicationSchema,
  listZakatApplicationsSchema,
  zakatApplicationIdParamSchema,
  updateZakatStatusSchema,
  assignZakatOfficerSchema,
  setNisabRateSchema,
  saveAssessmentSchema,
  createZakatDistributionSchema,
} from './zakat.validation.js';
import { validate } from '../../common/middlewares/validate.js';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { authorize, authorizeAny } from '../../common/middlewares/authorize.js';
import { strictRateLimiter } from '../../common/middlewares/rateLimiter.js';

export const zakatPublicRouter = Router();
export const zakatAdminRouter = Router();
export const zakatAccountRouter = Router();


zakatAccountRouter.use(authenticate);
zakatAccountRouter.get('/assessments', zakatController.listAssessments);
zakatAccountRouter.post('/assessments', validate(saveAssessmentSchema), zakatController.saveAssessment);
zakatAccountRouter.delete('/assessments/:id', validate(zakatApplicationIdParamSchema), zakatController.deleteAssessment);

const submitLimiter = strictRateLimiter({ windowMs: 60 * 60 * 1000, max: 10 });
const trackLimiter = strictRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 });

/**
 * @openapi
 * /services/zakat/applications:
 *   post:
 *     summary: Submit a Zakat/social welfare aid application (no login required)
 *     tags: [Zakat]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [woredaId, applicantFullName, applicantPhone]
 *             properties:
 *               woredaId: { type: integer }
 *               applicantFullName: { type: string }
 *               applicantPhone: { type: string }
 *               householdSize: { type: integer }
 *               eligibilityNotes: { type: string }
 *     responses:
 *       201:
 *         description: Application created — returns a referenceNumber the applicant should save
 */
zakatPublicRouter.post(
  '/applications',
  submitLimiter,
  validate(submitZakatApplicationSchema),
  zakatController.submit
);

/**
 * @openapi
 * /services/zakat/applications/track/{reference}:
 *   get:
 *     summary: Check an application's status by reference number + phone
 *     tags: [Zakat]
 *     parameters:
 *       - in: path
 *         name: reference
 *         required: true
 *         schema: { type: string, example: ZKT-2026-00042 }
 *       - in: query
 *         name: phone
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Application status }
 *       404: { description: No match for that reference + phone combination }
 */
zakatPublicRouter.get(
  '/applications/track/:reference',
  trackLimiter,
  validate(trackZakatApplicationSchema),
  zakatController.track
);

/**
 * @openapi
 * /zakat/rates:
 *   get:
 *     summary: Current Nisab (gold/silver) rates, used by the Zakat/Ushr calculator
 *     tags: [Zakat]
 *     responses:
 *       200: { description: Current rate, or null if none has been set yet }
 */
zakatPublicRouter.get('/rates', zakatController.currentRate);

// --- Admin (case_officer / finance_officer / super_admin) ---
zakatAdminRouter.use(authenticate);

zakatAdminRouter.get('/distributions', authorizeAny('zakat.manage', 'finance.write'), zakatController.listDistributions);
zakatAdminRouter.post(
  '/distributions',
  authorizeAny('zakat.manage', 'finance.write'),
  validate(createZakatDistributionSchema),
  zakatController.createDistribution
);

/**
 * @openapi
 * /admin/zakat/applications:
 *   get:
 *     summary: List Zakat applications
 *     tags: [Admin - Zakat]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, COMPLETED, CANCELLED] }
 *       - in: query
 *         name: woredaId
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200: { description: Paginated list }
 */
zakatAdminRouter.get(
  '/applications',
  authorize('zakat.manage'),
  validate(listZakatApplicationsSchema),
  zakatController.list
);

zakatAdminRouter.get(
  '/applications/:id',
  authorize('zakat.manage'),
  validate(zakatApplicationIdParamSchema),
  zakatController.getById
);

/**
 * @openapi
 * /admin/zakat/applications/{id}/status:
 *   patch:
 *     summary: Update an application's status
 *     tags: [Admin - Zakat]
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
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED, COMPLETED, CANCELLED] }
 *               eligibilityNotes: { type: string }
 *     responses:
 *       200: { description: Updated }
 */
zakatAdminRouter.patch(
  '/applications/:id/status',
  authorize('zakat.manage'),
  validate(updateZakatStatusSchema),
  zakatController.updateStatus
);

/**
 * @openapi
 * /admin/zakat/applications/{id}/assign:
 *   patch:
 *     summary: Assign (or unassign) a case officer
 *     tags: [Admin - Zakat]
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
 *             required: [assignedOfficerId]
 *             properties:
 *               assignedOfficerId: { type: integer, nullable: true }
 *     responses:
 *       200: { description: Updated }
 */
zakatAdminRouter.patch(
  '/applications/:id/assign',
  authorize('zakat.manage'),
  validate(assignZakatOfficerSchema),
  zakatController.assignOfficer
);

/**
 * @openapi
 * /admin/zakat/rates:
 *   post:
 *     summary: Set a new current Nisab rate (finance_officer)
 *     tags: [Admin - Zakat]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [goldPricePerGram, silverPricePerGram]
 *             properties:
 *               goldPricePerGram: { type: number }
 *               silverPricePerGram: { type: number }
 *               effectiveDate: { type: string, format: date-time }
 *     responses:
 *       201: { description: New rate recorded }
 */
zakatAdminRouter.post(
  '/rates',
  authorize('zakat.rates.write'),
  validate(setNisabRateSchema),
  zakatController.setRate
);
