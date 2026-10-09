import { z, idParamSchema, paginationQuerySchema } from '../../common/validation/shared.js';
import { SUPPORTED_LOCALES } from '../../common/services/translation.service.js';

const localeEnum = z.enum(SUPPORTED_LOCALES);
const translationsShape = z.record(localeEnum, z.string().trim().min(1)).optional();

export const listMadrasasSchema = z.object({
  query: paginationQuerySchema.extend({
    locale: localeEnum.optional(),
    woredaId: z.coerce.number().int().positive().optional(),
    search: z.string().trim().min(1).optional(),
  }),
});

export const madrasaIdParamSchema = z.object({
  params: idParamSchema,
});

const madrasaBodyBase = {
  woredaId: z.coerce.number().int().positive(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  capacity: z.coerce.number().int().positive().optional(),
  hasBoarding: z.boolean().optional(),
  hifzGraduatesCount: z.number().int().min(0).nullable().optional(),
  isPublished: z.boolean().optional(),
  name: translationsShape,
  description: translationsShape,
};

export const createMadrasaSchema = z.object({
  body: z.object(madrasaBodyBase),
});

export const updateMadrasaSchema = z.object({
  params: idParamSchema,
  body: z
    .object(
      {
        ...Object.fromEntries(
          Object.entries(madrasaBodyBase).map(([key, schema]) => [key, schema.optional()])
        ),
        headTeacherId: z.number().int().positive().nullable().optional(),
      }
    )
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
});