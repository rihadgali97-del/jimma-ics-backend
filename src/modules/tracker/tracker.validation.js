import { z } from '../../common/validation/shared.js';

const phoneSchema = z
  .string()
  .trim()
  .regex(/^[0-9+()\-\s]{7,20}$/, 'Enter a valid phone number');

export const trackSchema = z.object({
  params: z.object({ reference: z.string().trim().min(1) }),
  query: z.object({ phone: phoneSchema }),
});