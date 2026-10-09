import { z, idParamSchema } from '../../common/validation/shared.js';

export const uploadCouncilArchiveSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1).max(255),
    category: z.string().trim().min(1).max(100),
    description: z.string().trim().max(5000).optional().default(''),
  }),
});

export const councilArchiveIdSchema = z.object({ params: idParamSchema });
