import { z, idParamSchema, paginationQuerySchema } from '../../common/validation/shared.js';
import { SUPPORTED_LOCALES } from '../../common/services/translation.service.js';

const localeEnum = z.enum(SUPPORTED_LOCALES);
const translationsShape = z.record(localeEnum, z.string().trim().min(1)).optional();
const prayerNameEnum = z.enum(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha', 'jumuah']);
const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'time must be in HH:MM (24h) format');

export const listMosquesSchema = z.object({
  query: paginationQuerySchema.extend({
    locale: localeEnum.optional(),
    woredaId: z.coerce.number().int().positive().optional(),
    search: z.string().trim().min(1).optional(),
  }),
});

export const mosqueIdParamSchema = z.object({
  params: idParamSchema,
});

const mosqueBodyBase = {
  code: z.string().trim().max(50).nullable().optional(),
  category: z.enum(["Jumaa'a", "Jama'a"]).nullable().optional(),
  woredaId: z.coerce.number().int().positive(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  capacity: z.coerce.number().int().positive().optional(),
  hasWuduFacility: z.boolean().optional(),
  hasBoarding: z.boolean().optional(),
  madrasaId: z.number().int().positive().nullable().optional(),
  imamName: z.string().trim().min(2).max(150).optional(),
  isPublished: z.boolean().optional(),
  name: translationsShape,
  description: translationsShape,
};

export const createMosqueSchema = z.object({
  body: z.object(mosqueBodyBase),
});

export const updateMosqueSchema = z.object({
  params: idParamSchema,
  body: z
    .object(
      Object.fromEntries(
        Object.entries(mosqueBodyBase).map(([key, schema]) => [key, schema.optional()])
      )
    )
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
});

export const upsertPrayerTimesSchema = z.object({
  params: idParamSchema,
  body: z.object({
    prayerTimes: z
      .array(z.object({ prayerName: prayerNameEnum, time: timeString }))
      .min(1)
      .max(6)
      .refine((arr) => new Set(arr.map((p) => p.prayerName)).size === arr.length, {
        message: 'Duplicate prayerName entries are not allowed',
      }),
  }),
});