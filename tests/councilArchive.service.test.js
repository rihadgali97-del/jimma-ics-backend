import { jest } from '@jest/globals';
import { Readable, Writable } from 'node:stream';

process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
process.env.CLOUDINARY_API_KEY = 'test-key';
process.env.CLOUDINARY_API_SECRET = 'test-secret';

const mockRepository = {
  findMany: jest.fn(),
  create: jest.fn(),
  findById: jest.fn(),
  delete: jest.fn(),
  createShareLink: jest.fn(),
  findValidShareLink: jest.fn(),
  deleteExpiredShareLinks: jest.fn(),
};
const mockWriteAuditLog = jest.fn();
const mockCloudinary = {
  config: jest.fn(),
  url: jest.fn(),
  uploader: {
    upload_stream: jest.fn(),
    destroy: jest.fn(),
  },
};

jest.unstable_mockModule('cloudinary', () => ({ v2: mockCloudinary }));
jest.unstable_mockModule('../src/modules/documents/documents.repository.js', () => ({
  councilArchiveRepository: mockRepository,
}));
jest.unstable_mockModule('../src/common/utils/auditLog.js', () => ({ writeAuditLog: mockWriteAuditLog }));

const archiveService = await import('../src/modules/documents/councilArchive.service.js');

const archiveDocument = {
  id: 17,
  title: 'Council meeting minutes',
  category: 'Meeting Records',
  description: 'Approved minutes',
  fileName: 'minutes.custom',
  mimeType: 'application/octet-stream',
  sizeBytes: 7,
  cloudinaryPublicId: 'council-documents/minutes.custom',
  cloudinaryVersion: 123456,
  uploadedBy: 4,
  createdAt: new Date('2026-10-03T00:00:00.000Z'),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockRepository.create.mockResolvedValue(archiveDocument);
  mockRepository.findById.mockResolvedValue(archiveDocument);
  mockRepository.findMany.mockResolvedValue([archiveDocument]);
  mockRepository.delete.mockResolvedValue(archiveDocument);
  mockRepository.createShareLink.mockResolvedValue({});
  mockRepository.findValidShareLink.mockResolvedValue({ document: archiveDocument });
  mockRepository.deleteExpiredShareLinks.mockResolvedValue({ count: 0 });
  mockWriteAuditLog.mockResolvedValue(undefined);
  mockCloudinary.uploader.upload_stream.mockImplementation((_options, callback) => new Writable({
    write(_chunk, _encoding, done) {
      done();
    },
    final(done) {
      callback(undefined, { public_id: archiveDocument.cloudinaryPublicId, version: archiveDocument.cloudinaryVersion });
      done();
    },
  }));
  mockCloudinary.uploader.destroy.mockResolvedValue({ result: 'ok' });
});

it('creates a seven-day share link while storing only a token hash', async () => {
  const before = Date.now();
  const share = await archiveService.createCouncilDocumentShareLink(archiveDocument.id, 4);
  const after = Date.now();

  expect(share.token).toMatch(/^[a-f0-9]{64}$/);
  expect(new Date(share.expiresAt).getTime()).toBeGreaterThanOrEqual(before + 7 * 24 * 60 * 60 * 1000);
  expect(new Date(share.expiresAt).getTime()).toBeLessThanOrEqual(after + 7 * 24 * 60 * 60 * 1000);
  const storedLink = mockRepository.createShareLink.mock.calls[0][0];
  expect(storedLink.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  expect(storedLink.tokenHash).not.toBe(share.token);
  expect(mockRepository.deleteExpiredShareLinks).toHaveBeenCalled();
});

it('rejects invalid or expired share links', async () => {
  mockRepository.findValidShareLink.mockResolvedValue(null);

  await expect(archiveService.downloadSharedCouncilDocument('a'.repeat(64)))
    .rejects.toMatchObject({ statusCode: 404 });
});

describe('Council archive service', () => {
  it('stores arbitrary file types as authenticated raw Cloudinary assets', async () => {
    const file = {
      buffer: Buffer.from('archive'),
      originalname: 'C:\\temporary\\minutes.custom',
      mimetype: 'application/octet-stream',
      size: 7,
    };

    const result = await archiveService.createCouncilArchiveDocument({
      file,
      title: archiveDocument.title,
      category: archiveDocument.category,
      description: archiveDocument.description,
    }, 4);

    expect(mockCloudinary.uploader.upload_stream).toHaveBeenCalledWith(
      expect.objectContaining({ resource_type: 'raw', type: 'authenticated' }),
      expect.any(Function)
    );
    expect(mockRepository.create).toHaveBeenCalledWith(expect.objectContaining({
      fileName: 'minutes.custom',
      mimeType: 'application/octet-stream',
      cloudinaryPublicId: archiveDocument.cloudinaryPublicId,
      uploadedBy: 4,
    }));
    expect(result).not.toHaveProperty('cloudinaryPublicId');
    expect(result).not.toHaveProperty('cloudinaryVersion');
  });

  it('explains Cloudinary create-permission failures', async () => {
    mockCloudinary.uploader.upload_stream.mockImplementation((_options, callback) => {
      const stream = new Writable({
        write(_chunk, _encoding, done) {
          done();
        },
        final(done) {
          callback({
            message: 'Request forbidden due to missing permissions',
            http_code: 403,
            name: 'UnexpectedResponse',
          });
          done();
        },
      });
      return stream;
    });

    await expect(archiveService.createCouncilArchiveDocument({
      file: {
        buffer: Buffer.from('archive'),
        originalname: 'minutes.custom',
        mimetype: 'application/octet-stream',
        size: 7,
      },
      title: archiveDocument.title,
      category: archiveDocument.category,
      description: '',
    }, 4)).rejects.toMatchObject({
      statusCode: 503,
      code: 'DOCUMENT_STORAGE_PERMISSION_DENIED',
      message: expect.stringContaining('missing create permission'),
    });
    expect(mockRepository.create).not.toHaveBeenCalled();
  });

  it('streams a document only through a signed authenticated Cloudinary URL', async () => {
    mockCloudinary.url.mockReturnValue('https://cloudinary.test/signed-document');
    const upstreamBody = Readable.toWeb(Readable.from(['archive']));
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, body: upstreamBody });

    try {
      const result = await archiveService.downloadCouncilArchiveDocument(archiveDocument.id);

      expect(mockCloudinary.url).toHaveBeenCalledWith(archiveDocument.cloudinaryPublicId, expect.objectContaining({
        resource_type: 'raw',
        type: 'authenticated',
        sign_url: true,
      }));
      expect(fetchMock).toHaveBeenCalledWith('https://cloudinary.test/signed-document');
      expect(result.document).toEqual(archiveDocument);
    } finally {
      fetchMock.mockRestore();
    }
  });

  it('deletes the cloud asset and archive row and records the action', async () => {
    await archiveService.deleteCouncilArchiveDocument(archiveDocument.id, 4);

    expect(mockCloudinary.uploader.destroy).toHaveBeenCalledWith(archiveDocument.cloudinaryPublicId, expect.objectContaining({
      resource_type: 'raw',
      type: 'authenticated',
    }));
    expect(mockRepository.delete).toHaveBeenCalledWith(archiveDocument.id);
    expect(mockWriteAuditLog).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 4,
      action: 'delete',
      entityType: 'council_archive_document',
    }));
  });
});
