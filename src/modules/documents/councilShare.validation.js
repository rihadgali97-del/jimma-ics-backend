import { z, idParamSchema } from '../../common/validation/shared.js';

export const councilShareDocumentIdSchema = z.object({ params: idParamSchema });

export const councilShareTokenSchema = z.object({
  params: z.object({ token: z.string().regex(/^[a-f0-9]{64}$/i) }),
});
