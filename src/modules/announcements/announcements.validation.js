import { z, idParamSchema, paginationQuerySchema } from '../../common/validation/shared.js';

const categories = ['Official Communique', 'Moon Sighting', 'Zakat Nisab', 'Academic Calendar', 'Council Advisory'];
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}, 'Enter a valid calendar date');
const fields = {
  title: z.string().trim().min(3).max(240),
  category: z.enum(categories),
  publishDate: dateString,
  hijriDate: z.string().trim().max(100).default(''),
  author: z.string().trim().min(2).max(200),
  summary: z.string().trim().min(1).max(5000),
  content: z.string().trim().min(1).max(30000),
  isPinned: z.boolean().default(false),
  isUrgent: z.boolean().default(false),
  priority: z.enum(['High', 'Normal']).default('Normal'),
  district: z.string().trim().max(150).optional(),
  targetAudience: z.string().trim().max(200).optional(),
  readTime: z.string().trim().max(30).default('1 min read'),
  isPublished: z.boolean().default(true),
};

export const listAnnouncementsSchema = z.object({
  query: paginationQuerySchema.extend({
    search: z.string().trim().min(1).optional(),
    category: z.enum(categories).optional(),
    priority: z.enum(['High', 'Normal']).optional(),
  }),
});
export const announcementIdSchema = z.object({ params: idParamSchema });
export const createAnnouncementSchema = z.object({ body: z.object(fields) });
export const updateAnnouncementSchema = z.object({
  params: idParamSchema,
  body: z.object(Object.fromEntries(Object.entries(fields).map(([key, schema]) => [key, schema.optional()])))
    .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' }),
});
