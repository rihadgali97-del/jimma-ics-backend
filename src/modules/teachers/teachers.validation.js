import { z, paginationQuerySchema, idParamSchema } from '../../common/validation/shared.js';

const teacherFields = {
  madrasaId: z.coerce.number().int().positive(),
  name: z.string().trim().min(2).max(180),
  qualification: z.string().trim().min(1).max(5000),
  specialization: z.string().trim().min(1).max(240),
  experienceYears: z.coerce.number().int().min(0).max(80),
  studentsCount: z.coerce.number().int().min(0).max(10000),
  assignedStudentsCount: z.coerce.number().int().min(0).max(10000).nullable().optional(),
  phone: z.string().trim().min(6).max(30),
  email: z.string().trim().email().max(255),
  status: z.enum(['Active', 'On Leave']),
  avatar: z.string().url().max(1000).nullable().optional(),
  sanad: z.string().trim().max(5000).nullable().optional(),
  salaryETB: z.coerce.number().min(0).nullable().optional(),
  isCertified: z.boolean(),
  isFeatured: z.boolean(),
  isPublished: z.boolean(),
};

export const listTeachersSchema = z.object({
  query: paginationQuerySchema.extend({
    search: z.string().trim().min(1).optional(),
    madrasaId: z.coerce.number().int().positive().optional(),
    status: z.enum(['Active', 'On Leave']).optional(),
  }),
});

export const teacherIdParamSchema = z.object({ params: idParamSchema });
export const createTeacherSchema = z.object({
  body: z.object(teacherFields).refine((value) => !value.isFeatured || value.isPublished, {
    message: 'A featured teacher must be published to the public directory',
  }),
});
export const updateTeacherSchema = z.object({
  params: idParamSchema,
  body: z.object(teacherFields).partial().refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  }),
});
