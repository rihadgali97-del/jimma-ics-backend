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

export const updateJanazahAvailabilitySchema = z.object({
  body: z.object({
    isEnabled: z.boolean(),
  }),
});

// --- Public: submit request (urgent — 24/7 bereavement service) ---
export const submitJanazahRequestSchema = z.object({
  body: z.object({
    woredaId: z.coerce.number().int().positive(),
    deceasedName: z.string().trim().min(2).max(150),
    contactName: z.string().trim().min(2).max(150),
    contactPhone: phoneSchema,
    needsGhusl: z.boolean().optional(),
    needsTransport: z.boolean().optional(),
    needsCemeteryPlot: z.boolean().optional(),
    locationNote: z.string().trim().max(500).optional(),
  }),
});

export const trackJanazahRequestSchema = z.object({
  params: z.object({ reference: z.string().trim().min(1) }),
  query: z.object({ phone: phoneSchema }),
});

// --- Admin ---
export const listJanazahRequestsSchema = z.object({
  query: paginationQuerySchema.extend({
    status: z.enum(STATUS_VALUES).optional(),
    woredaId: z.coerce.number().int().positive().optional(),
    assignedOfficerId: z.coerce.number().int().positive().optional(),
    search: z.string().trim().min(1).optional(),
  }),
});

export const janazahRequestIdParamSchema = z.object({ params: idParamSchema });

export const updateJanazahStatusSchema = z.object({
  params: idParamSchema,
  body: z.object({
    status: z.enum(STATUS_VALUES),
  }),
});

export const assignJanazahOfficerSchema = z.object({
  params: idParamSchema,
  body: z.object({
    assignedOfficerId: z.coerce.number().int().positive().nullable(),
  }),
});

// --- Cemetery plots ---
export const listCemeteryPlotsSchema = z.object({
  query: paginationQuerySchema.extend({
    woredaId: z.coerce.number().int().positive().optional(),
    isAvailable: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
  }),
});

export const createCemeteryPlotSchema = z.object({
  body: z.object({
    woredaId: z.coerce.number().int().positive(),
    code: z.string().trim().min(1).max(50),
    isAvailable: z.boolean().optional(),
  }),
});

export const updateCemeteryPlotSchema = z.object({
  params: idParamSchema,
  body: z
    .object({
      isAvailable: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
});