import { z, idParamSchema, paginationQuerySchema } from '../../common/validation/shared.js';
import { SUPPORTED_LOCALES } from '../../common/services/translation.service.js';

const localeEnum = z.enum(SUPPORTED_LOCALES);
const translationsShape = z.record(localeEnum, z.string().trim().min(1)).optional();

export const listLeadershipSchema = z.object({
  query: paginationQuerySchema.extend({
    locale: localeEnum.optional(),
  }),
});

export const leadershipIdParamSchema = z.object({ params: idParamSchema });

const leadershipBodyBase = {
  displayOrder: z.coerce.number().int().optional(),
  isPublished: z.boolean().optional(),
  name: z.record(localeEnum, z.string().trim().min(1)),
  role: z.record(localeEnum, z.string().trim().min(1)),
  bio: translationsShape,
};

export const createLeadershipSchema = z.object({
  body: z.object(leadershipBodyBase),
});

export const updateLeadershipSchema = z.object({
  params: idParamSchema,
  body: z
    .object({
      displayOrder: leadershipBodyBase.displayOrder,
      isPublished: leadershipBodyBase.isPublished,
      name: translationsShape,
      role: translationsShape,
      bio: translationsShape,
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
});