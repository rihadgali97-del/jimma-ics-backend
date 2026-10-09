import { z, idParamSchema, paginationQuerySchema } from '../../common/validation/shared.js';

const STATUS_VALUES = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'COMPLETED',
  'CANCELLED',
];

const phoneSchema = z
  .string()
  .trim()
  .regex(/^[0-9+()\-\s]{7,20}$/, 'Enter a valid phone number');

// --- Public: submit application ---
export const submitZakatApplicationSchema = z.object({
  body: z.object({
    woredaId: z.coerce.number().int().positive(),
    applicantFullName: z.string().trim().min(2).max(150),
    applicantPhone: phoneSchema,
    householdSize: z.coerce.number().int().positive().max(100).optional(),
    eligibilityNotes: z.string().trim().max(2000).optional(),
  }),
});

// --- Public: track by reference + phone ---
export const trackZakatApplicationSchema = z.object({
  params: z.object({ reference: z.string().trim().min(1) }),
  query: z.object({ phone: phoneSchema }),
});

// --- Admin ---
export const listZakatApplicationsSchema = z.object({
  query: paginationQuerySchema.extend({
    status: z.enum(STATUS_VALUES).optional(),
    woredaId: z.coerce.number().int().positive().optional(),
    assignedOfficerId: z.coerce.number().int().positive().optional(),
    search: z.string().trim().min(1).optional(),
  }),
});

export const zakatApplicationIdParamSchema = z.object({ params: idParamSchema });

export const updateZakatStatusSchema = z.object({
  params: idParamSchema,
  body: z.object({
    status: z.enum(STATUS_VALUES),
    eligibilityNotes: z.string().trim().max(2000).optional(),
  }),
});

export const assignZakatOfficerSchema = z.object({
  params: idParamSchema,
  body: z.object({
    assignedOfficerId: z.coerce.number().int().positive().nullable(),
  }),
});

// --- Nisab rates ---
export const setNisabRateSchema = z.object({
  body: z.object({
    goldPricePerGram: z.coerce.number().positive(),
    silverPricePerGram: z.coerce.number().positive(),
    effectiveDate: z.coerce.date().optional(), // defaults to now in the service
  }),
});

export const saveAssessmentSchema = z.object({
  body: z.object({
    title: z.string().trim().min(2).max(180),
    summary: z.record(z.unknown()),
  }),
});

export const createZakatDistributionSchema = z.object({
  body: z.object({
    asnafCategory: z.string().trim().min(2).max(120),
    arabicName: z.string().trim().max(180).optional(),
    woredaDistrict: z.string().trim().max(180).optional(),
    beneficiaryCount: z.coerce.number().int().positive().max(100000).optional(),
    totalDisbursedETB: z.coerce.number().positive(),
    lastDisbursalDate: z.coerce.date().optional(),
    distributionChannel: z.string().trim().max(120).optional(),
    leadOfficer: z.string().trim().max(150).optional(),
    notes: z.string().trim().max(4000).default(''),
    beneficiaryName: z.string().trim().max(150).optional(),
    category: z.string().trim().max(100).optional(),
    amountETB: z.coerce.number().positive().optional(),
    district: z.string().trim().max(180).optional(),
    verificationStatus: z.string().trim().max(40).optional(),
    disbursementDate: z.coerce.date().optional(),
    approvedBy: z.string().trim().max(150).optional(),
  }),
});
