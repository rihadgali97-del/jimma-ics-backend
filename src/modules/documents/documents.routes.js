import { Router } from 'express';
import * as documentsController from './documents.controller.js';
import {
  uploadDocumentSchema,
  listDocumentsSchema,
  documentIdParamSchema,
} from './documents.validation.js';
import { validate } from '../../common/middlewares/validate.js';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { authorize } from '../../common/middlewares/authorize.js';
import { councilDocumentUpload, upload } from '../../common/middlewares/upload.js';
import * as councilArchiveController from './councilArchive.controller.js';
import { councilArchiveIdSchema, uploadCouncilArchiveSchema } from './councilArchive.validation.js';
import { councilShareDocumentIdSchema, councilShareTokenSchema } from './councilShare.validation.js';

export const documentsRouter = Router();

documentsRouter.get(
  '/shared/:token',
  validate(councilShareTokenSchema),
  councilArchiveController.downloadSharedCouncilArchiveDocument
);

// All document management is admin-only in Phase 3. Public application
// forms (Nikah/Zakat/Janazah, Phase 4) will get their own rate-limited,
// unauthenticated upload path when those modules are built — file uploads
// from anonymous citizens need stricter validation than this admin path.
documentsRouter.use(authenticate, authorize('documents.write'));

documentsRouter.get('/council', councilArchiveController.listCouncilArchive);
documentsRouter.post(
  '/council/:id/share-link',
  validate(councilShareDocumentIdSchema),
  councilArchiveController.createCouncilArchiveShareLink
);
documentsRouter.post(
  '/council',
  councilDocumentUpload,
  validate(uploadCouncilArchiveSchema),
  councilArchiveController.uploadCouncilArchive
);
documentsRouter.get(
  '/council/:id/file',
  validate(councilArchiveIdSchema),
  councilArchiveController.downloadCouncilArchive
);
documentsRouter.delete(
  '/council/:id',
  validate(councilArchiveIdSchema),
  councilArchiveController.deleteCouncilArchive
);

/**
 * @openapi
 * /documents:
 *   post:
 *     summary: Upload a file and attach it to an entity (e.g. a mosque's photo)
 *     tags: [Documents]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, entityType, entityId]
 *             properties:
 *               file: { type: string, format: binary }
 *               entityType: { type: string, example: mosque }
 *               entityId: { type: integer }
 *     responses:
 *       201: { description: Uploaded }
 *       400: { description: Missing file or unsupported file type }
 */
documentsRouter.post('/', upload.single('file'), validate(uploadDocumentSchema), documentsController.upload);

/**
 * @openapi
 * /documents:
 *   get:
 *     summary: List documents attached to an entity
 *     tags: [Documents]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: entityType
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: entityId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { description: List of documents }
 */
documentsRouter.get('/', validate(listDocumentsSchema), documentsController.listForEntity);

/**
 * @openapi
 * /documents/{id}:
 *   delete:
 *     summary: Delete a document
 *     tags: [Documents]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204: { description: Deleted }
 *       404: { description: Not found }
 */
documentsRouter.delete('/:id', validate(documentIdParamSchema), documentsController.remove);