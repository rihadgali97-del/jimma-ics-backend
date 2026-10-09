import { z, idParamSchema, paginationQuerySchema } from '../../common/validation/shared.js';
import { SUPPORTED_LOCALES } from '../../common/services/translation.service.js';

const localeEnum = z.enum(SUPPORTED_LOCALES);
const translationsShape = z.record(localeEnum, z.string().trim().min(1)).optional();

export const listFatwasSchema = z.object({
  query: paginationQuerySchema.extend({
    locale: localeEnum.optional(),
    category: z.string().trim().min(1).optional(),
    search: z.string().trim().min(1).optional(),
  }),
});

export const fatwaIdParamSchema = z.object({ params: idParamSchema });

const fatwaBodyBase = {
  category: z.string().trim().min(1).max(50),
  isPublished: z.boolean().optional(),
  publishedAt: z.coerce.date().optional(),
  question: z.record(localeEnum, z.string().trim().min(1)),
  ruling: z.record(localeEnum, z.string().trim().min(1)),
};

export const createFatwaSchema = z.object({
  body: z.object(fatwaBodyBase),
});

export const updateFatwaSchema = z.object({
  params: idParamSchema,
  body: z
    .object({
      category: fatwaBodyBase.category.optional(),
      isPublished: fatwaBodyBase.isPublished,
      publishedAt: fatwaBodyBase.publishedAt,
      question: translationsShape,
      ruling: translationsShape,
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
});