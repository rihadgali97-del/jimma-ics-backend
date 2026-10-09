import { z } from '../../common/validation/shared.js';

// Shared password policy for both reset and (future) admin-created accounts.
const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters')
  .max(128, 'Password must be at most 128 characters');

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().email().transform((value) => value.toLowerCase()),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const registerSchema = z.object({
  body: z.object({
    fullName: z.string().trim().min(2).max(150),
    email: z.string().trim().email().transform((value) => value.toLowerCase()),
    phone: z.string().trim().min(6).max(30).optional(),
    password: passwordSchema,
  }),
});

export const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'refreshToken is required'),
  }),
});

export const logoutSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'refreshToken is required'),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email(),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'token is required'),
    newPassword: passwordSchema,
  }),
});

export { passwordSchema };
