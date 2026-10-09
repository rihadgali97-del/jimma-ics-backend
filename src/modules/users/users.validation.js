import { z, paginationQuerySchema, idParamSchema } from '../../common/validation/shared.js';
import { passwordSchema } from '../auth/auth.validation.js';

export const listUsersSchema = z.object({
  query: paginationQuerySchema.extend({
    search: z.string().trim().min(1).optional(),
    roleId: z.coerce.number().int().positive().optional(),
    isActive: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
  }),
});

export const createUserSchema = z.object({
  body: z.object({
    fullName: z.string().trim().min(2).max(150),
    email: z.string().email(),
    phone: z.string().trim().min(6).max(30).optional(),
    password: passwordSchema,
    roleId: z.coerce.number().int().positive(),
    isActive: z.boolean().optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
});

export const updateUserSchema = z.object({
  params: idParamSchema,
  body: z
    .object({
      fullName: z.string().trim().min(2).max(150).optional(),
      email: z.string().email().optional(),
      phone: z.string().trim().min(6).max(30).nullable().optional(),
      roleId: z.coerce.number().int().positive().optional(),
      isActive: z.boolean().optional(),
      metadata: z.record(z.unknown()).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
});

export const userIdParamSchema = z.object({
  params: idParamSchema,
});