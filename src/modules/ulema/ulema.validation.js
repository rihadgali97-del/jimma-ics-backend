import { z, paginationQuerySchema, idParamSchema } from '../../common/validation/shared.js';

const profileFields = {
  name: z.string().trim().min(2).max(180),
  arabicName: z.string().trim().max(180).nullable().optional(),
  title: z.string().trim().min(2).max(180),
  specializations: z.array(z.string().trim().min(1).max(160)).max(20),
  district: z.string().trim().min(2).max(120),
  assignedMosqueId: z.string().trim().max(120).nullable().optional(),
  assignedMosqueName: z.string().trim().max(180).nullable().optional(),
  qualifications: z.array(z.string().trim().min(1).max(500)).max(30),
  languages: z.array(z.string().trim().min(1).max(80)).max(20),
  areasOfService: z.array(z.string().trim().min(1).max(240)).max(30),
  biography: z.string().trim().min(1).max(10000),
  contactPhone: z.string().trim().min(6).max(30),
  email: z.string().trim().email().max(255),
  status: z.enum(['Active', 'Senior Advisor', 'Visiting Scholar']),
  avatar: z.string().max(1000).nullable().optional(),
  yearsOfDawah: z.coerce.number().int().min(0).max(100),
  isFeatured: z.boolean(),
  isPublished: z.boolean(),
};

export const listUlemaSchema = z.object({
  query: paginationQuerySchema.extend({
    search: z.string().trim().min(1).optional(),
    district: z.string().trim().min(1).optional(),
    status: z.enum(['Active', 'Senior Advisor', 'Visiting Scholar']).optional(),
  }),
});

export const ulemaIdParamSchema = z.object({ params: idParamSchema });
export const createUlemaSchema = z.object({
  body: z.object(profileFields).refine((value) => !value.isFeatured || value.isPublished, {
    message: 'A featured scholar must be published to the public directory',
  }),
});
export const updateUlemaSchema = z.object({
  params: idParamSchema,
  body: z.object(profileFields).partial().refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  }).refine((value) => !value.isFeatured || value.isPublished, {
    message: 'A featured scholar must be published to the public directory',
  }),
});
