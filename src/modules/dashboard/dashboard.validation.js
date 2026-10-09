import { z } from '../../common/validation/shared.js';

export const getDashboardSummarySchema = z.object({
  query: z.object({
    refresh: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => v === 'true'),
  }),
});