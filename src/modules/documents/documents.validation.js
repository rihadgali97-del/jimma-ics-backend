import { z, idParamSchema } from '../../common/validation/shared.js';

// entityType/entityId identify what this upload belongs to, e.g.
// entityType="mosque", entityId=<mosque id>. The frontend uploads the file
// first, gets back a document id/url, then references it when
// creating/updating the owning record (or the owning record's own endpoint
// accepts entityId directly, as mosques/madrasas do for photos).
export const uploadDocumentSchema = z.object({
  body: z.object({
    entityType: z.string().trim().min(1).max(50),
    entityId: z.coerce.number().int().positive(),
  }),
});

export const listDocumentsSchema = z.object({
  query: z.object({
    entityType: z.string().trim().min(1).max(50),
    entityId: z.coerce.number().int().positive(),
  }),
});

export const documentIdParamSchema = z.object({
  params: idParamSchema,
});