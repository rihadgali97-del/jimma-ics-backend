import { Router } from 'express';
import * as financeController from './finance.controller.js';
import {
  listFinancialReportsSchema,
  financialReportIdParamSchema,
  createFinancialReportSchema,
  updateFinancialReportSchema,
} from './finance.validation.js';
import { validate } from '../../common/middlewares/validate.js';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { authorize } from '../../common/middlewares/authorize.js';

export const financePublicRouter = Router();
export const financeAdminRouter = Router();

/**
 * @openapi
 * /transparency/financial-reports:
 *   get:
 *     summary: List published financial transparency reports
 *     tags: [Finance]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [BALANCE_SHEET, ZAKAT_AUDIT, EXPENDITURE] }
 *       - in: query
 *         name: locale
 *         schema: { type: string, enum: [en, am, om, ar] }
 *     responses:
 *       200: { description: Paginated list, newest period first }
 */
financePublicRouter.get('/', validate(listFinancialReportsSchema), financeController.list);

/**
 * @openapi
 * /transparency/financial-reports/{id}:
 *   get:
 *     summary: Get a single published financial report with its line items
 *     tags: [Finance]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: The report }
 *       404: { description: Not found or unpublished }
 */
financePublicRouter.get('/:id', validate(financialReportIdParamSchema), financeController.getById);

// --- Admin (finance_officer / super_admin) ---
financeAdminRouter.use(authenticate, authorize('finance.write'));

financeAdminRouter.get('/', validate(listFinancialReportsSchema), financeController.adminList);
financeAdminRouter.get(
  '/:id',
  validate(financialReportIdParamSchema),
  financeController.adminGetById
);

/**
 * @openapi
 * /admin/finance/reports:
 *   post:
 *     summary: Create a financial report with line items
 *     tags: [Admin - Finance]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, periodLabel, periodStart, periodEnd]
 *             properties:
 *               type: { type: string, enum: [BALANCE_SHEET, ZAKAT_AUDIT, EXPENDITURE] }
 *               periodLabel: { type: string, example: "Q1 2026" }
 *               periodStart: { type: string, format: date }
 *               periodEnd: { type: string, format: date }
 *               isPublished: { type: boolean }
 *               title:
 *                 type: object
 *                 properties: { en: { type: string }, am: { type: string }, om: { type: string }, ar: { type: string } }
 *               lineItems:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     category: { type: string }
 *                     amount: { type: number }
 *                     notes: { type: string }
 *     responses:
 *       201: { description: Created }
 */
financeAdminRouter.post('/', validate(createFinancialReportSchema), financeController.create);

/**
 * @openapi
 * /admin/finance/reports/{id}:
 *   patch:
 *     summary: Update a report (passing lineItems fully replaces the existing set)
 *     tags: [Admin - Finance]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: Updated }
 *       404: { description: Not found }
 */
financeAdminRouter.patch(
  '/:id',
  validate(updateFinancialReportSchema),
  financeController.update
);

/**
 * @openapi
 * /admin/finance/reports/{id}:
 *   delete:
 *     summary: Delete a financial report
 *     tags: [Admin - Finance]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204: { description: Deleted }
 *       404: { description: Not found }
 */
financeAdminRouter.delete(
  '/:id',
  validate(financialReportIdParamSchema),
  financeController.remove
);