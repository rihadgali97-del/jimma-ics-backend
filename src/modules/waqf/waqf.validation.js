import { z, idParamSchema, paginationQuerySchema } from '../../common/validation/shared.js';
import { SUPPORTED_LOCALES } from '../../common/services/translation.service.js';

const localeEnum = z.enum(SUPPORTED_LOCALES);
const translationsShape = z.record(localeEnum, z.string().trim().min(1)).optional();
const typeEnum = z.enum(['LAND', 'COMMERCIAL_RENTAL', 'AGRICULTURAL', 'CEMETERY']);
const statusEnum = z.enum(['ACTIVE', 'UNDER_MAINTENANCE', 'DISPUTED', 'INACTIVE']);

export const listWaqfAssetsSchema = z.object({
  query: paginationQuerySchema.extend({
    locale: localeEnum.optional(),
    woredaId: z.coerce.number().int().positive().optional(),
    type: typeEnum.optional(),
  }),
});

export const waqfAssetIdParamSchema = z.object({ params: idParamSchema });

const waqfBodyBase = {
  woredaId: z.coerce.number().int().positive(),
  type: typeEnum,
  status: statusEnum.optional(),
  locationNote: z.string().trim().max(500).optional(),
  monthlyIncome: z.coerce.number().nonnegative().optional(),
  tenantName: z.string().trim().max(150).optional(),
  tenantContact: z.string().trim().max(100).optional(),
  isPublished: z.boolean().optional(),
  name: translationsShape,
  description: translationsShape,
};

export const createWaqfAssetSchema = z.object({
  body: z.object(waqfBodyBase),
});

export const updateWaqfAssetSchema = z.object({
  params: idParamSchema,
  body: z
    .object(
      Object.fromEntries(
        Object.entries(waqfBodyBase).map(([key, schema]) => [key, schema.optional()])
      )
    )
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
});