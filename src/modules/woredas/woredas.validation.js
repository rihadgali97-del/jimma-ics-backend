import { z, idParamSchema, paginationQuerySchema } from '../../common/validation/shared.js';
import { SUPPORTED_LOCALES } from '../../common/services/translation.service.js';

const localeEnum = z.enum(SUPPORTED_LOCALES);
const translationsShape = z.record(localeEnum, z.string().trim().min(1)).optional();
const gisProfileFields = {
  oromoName: z.string().trim().max(180).nullable().optional(),
  arabicName: z.string().trim().max(180).nullable().optional(),
  zone: z.string().trim().max(120).nullable().optional(),
  climateZone: z.enum(['Highland (Dega)', 'Midland (Weyna Dega)', 'Lowland (Kolla)']).nullable().optional(),
  centerLatitude: z.number().min(-90).max(90).nullable().optional(),
  centerLongitude: z.number().min(-180).max(180).nullable().optional(),
  svgPath: z.string().max(50000).nullable().optional(),
  labelX: z.number().min(0).max(1000).nullable().optional(),
  labelY: z.number().min(0).max(650).nullable().optional(),
  areaKm2: z.number().nonnegative().nullable().optional(),
  elevationMeters: z.number().int().nullable().optional(),
  population: z.number().int().nonnegative().nullable().optional(),
  muslimPercentage: z.number().min(0).max(100).nullable().optional(),
  councilBranchHead: z.string().trim().max(180).nullable().optional(),
  headContact: z.string().trim().max(40).nullable().optional(),
  notableFeatures: z.array(z.string().trim().min(1).max(200)).max(50).nullable().optional(),
};

export const listWoredasSchema = z.object({
  query: paginationQuerySchema.extend({
    locale: localeEnum.optional(),
  }),
});

export const woredaIdParamSchema = z.object({
  params: idParamSchema,
});

export const createWoredaSchema = z.object({
  body: z.object({
    code: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9-]+$/, 'code must be lowercase letters, numbers, and hyphens only'),
    name: translationsShape, // { en: 'Agaro', am: '...', om: '...', ar: '...' }
    ...gisProfileFields,
  }),
});

export const updateWoredaSchema = z.object({
  params: idParamSchema,
  body: z
    .object({
      name: translationsShape,
      isActive: z.boolean().optional(),
      ...gisProfileFields,
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
});