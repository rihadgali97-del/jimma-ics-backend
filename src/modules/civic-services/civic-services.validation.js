import { z } from '../../common/validation/shared.js';

export const updateServiceAvailabilitySchema = z.object({
  params: z.object({
    serviceKey: z.enum(['srv-2', 'srv-4', 'srv-5', 'srv-6', 'srv-7', 'srv-8']),
  }),
  body: z.object({
    isEnabled: z.boolean(),
  }),
});
