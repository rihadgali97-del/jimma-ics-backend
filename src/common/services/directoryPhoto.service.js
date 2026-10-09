import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'node:stream';
import { AppError } from '../errors/AppError.js';
import { BadRequestError, NotFoundError } from '../errors/httpErrors.js';
import { env } from '../../config/env.js';
import { logger } from '../utils/logger.js';
import { writeAuditLog } from '../utils/auditLog.js';
import { madrasasRepository } from '../../modules/madrasas/madrasas.repository.js';
import { mosquesRepository } from '../../modules/mosques/mosques.repository.js';

function getCloudinary() {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new AppError('Directory image storage is not configured on the server', {
      statusCode: 503,
      code: 'IMAGE_STORAGE_NOT_CONFIGURED',
    });
  }

  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return cloudinary;
}

function uploadToCloudinary(file, entityType, entityId) {
  const client = getCloudinary();
  return new Promise((resolve, reject) => {
    const stream = client.uploader.upload_stream(
      {
        resource_type: 'image',
        folder: env.CLOUDINARY_DIRECTORY_IMAGES_FOLDER,
        public_id: `${entityType}-${entityId}-${Date.now()}`,
        overwrite: false,
        unique_filename: true,
      },
      (error, result) => {
        if (error) {
          logger.error(
            { cloudinaryStatus: error.http_code ?? null, cloudinaryError: error.message ?? 'Unknown upload error' },
            'Cloudinary directory image upload failed'
          );
          if (error.http_code === 403) {
            return reject(new AppError(
              'Cloudinary denied this image upload. Check the API key permissions.',
              { statusCode: 503, code: 'IMAGE_STORAGE_PERMISSION_DENIED' }
            ));
          }
          return reject(new AppError('Cloudinary could not store the image', {
            statusCode: 502,
            code: 'IMAGE_STORAGE_FAILED',
          }));
        }
        if (!result?.public_id || !result.secure_url) {
          return reject(new AppError('Cloudinary returned an incomplete image upload result', {
            statusCode: 502,
            code: 'IMAGE_STORAGE_FAILED',
          }));
        }
        resolve(result);
      }
    );
    Readable.from([file.buffer]).pipe(stream);
  });
}

async function removeFromCloudinary(publicId) {
  if (!publicId) return;
  const result = await getCloudinary().uploader.destroy(publicId, {
    resource_type: 'image',
    invalidate: true,
  });
  if (result.result !== 'ok' && result.result !== 'not found') {
    throw new AppError('Cloudinary could not remove the replaced image', {
      statusCode: 502,
      code: 'IMAGE_STORAGE_DELETE_FAILED',
    });
  }
}

export async function uploadDirectoryPhoto(entityType, entityId, file, actorId) {
  if (!file?.buffer?.length) throw new BadRequestError('Please select a photo to upload');

  const repository = entityType === 'mosque' ? mosquesRepository : madrasasRepository;
  const entity = await repository.findById(entityId);
  if (!entity) throw new NotFoundError(`${entityType === 'mosque' ? 'Mosque' : 'Madrasa'} not found`);

  const uploaded = await uploadToCloudinary(file, entityType, entityId);
  let updated;
  try {
    updated = await repository.update(entityId, {
      photoUrl: uploaded.secure_url,
      photoPublicId: uploaded.public_id,
    });
  } catch (error) {
    try {
      await removeFromCloudinary(uploaded.public_id);
    } catch (cleanupError) {
      logger.error({ err: cleanupError, publicId: uploaded.public_id }, 'Failed to remove Cloudinary image after directory update failure');
    }
    throw error;
  }

  await writeAuditLog({
    actorId,
    action: 'upload',
    entityType: `${entityType}_photo`,
    entityId,
    after: { publicId: uploaded.public_id, fileName: file.originalname },
  });

  if (entity.photoPublicId) {
    try {
      await removeFromCloudinary(entity.photoPublicId);
    } catch (error) {
      logger.error({ err: error, publicId: entity.photoPublicId }, 'Failed to remove replaced directory image from Cloudinary');
    }
  }
  return { url: updated.photoUrl };
}
