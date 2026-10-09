import { z, idParamSchema, paginationQuerySchema } from '../../common/validation/shared.js';
import { SUPPORTED_LOCALES } from '../../common/services/translation.service.js';

const localeEnum = z.enum(SUPPORTED_LOCALES);
const translationsShape = z.record(localeEnum, z.string().trim().min(1)).optional();
const typeEnum = z.enum(['BALANCE_SHEET', 'ZAKAT_AUDIT', 'EXPENDITURE']);

const lineItemSchema = z.object({
  category: z.string().trim().min(1).max(150),
  amount: z.coerce.number(),
  notes: z.string().trim().max(500).optional(),
});

export const listFinancialReportsSchema = z.object({
  query: paginationQuerySchema.extend({
    locale: localeEnum.optional(),
    type: typeEnum.optional(),
  }),
});

export const financialReportIdParamSchema = z.object({ params: idParamSchema });

export const createFinancialReportSchema = z.object({
  body: z.object({
    type: typeEnum,
    periodLabel: z.string().trim().min(1).max(100),
    periodStart: z.coerce.date(),
    periodEnd: z.coerce.date(),
    isPublished: z.boolean().optional(),
    title: translationsShape,
    summary: translationsShape,
    lineItems: z.array(lineItemSchema).max(200).optional(),
  }),
});

export const updateFinancialReportSchema = z.object({
  params: idParamSchema,
  body: z
    .object({
      type: typeEnum.optional(),
      periodLabel: z.string().trim().min(1).max(100).optional(),
      periodStart: z.coerce.date().optional(),
      periodEnd: z.coerce.date().optional(),
      isPublished: z.boolean().optional(),
      title: translationsShape,
      summary: translationsShape,
      lineItems: z.array(lineItemSchema).max(200).optional(), // full replace when provided
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
});