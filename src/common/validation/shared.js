import { z } from 'zod';

// `params: { id }` for any `/:id` route — coerces the string path param to
// a positive integer, matching our autoincrement Int primary keys.
export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

// Standard `?page=&pageSize=` query shape for list endpoints.
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().max(100).optional(),
});

export { z };