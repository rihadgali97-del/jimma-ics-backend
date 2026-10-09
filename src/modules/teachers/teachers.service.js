import { teachersRepository } from './teachers.repository.js';
import { NotFoundError, BadRequestError } from '../../common/errors/httpErrors.js';
import { writeAuditLog } from '../../common/utils/auditLog.js';
import { parsePagination, buildPaginationMeta } from '../../common/utils/pagination.js';
import { prisma } from '../../config/database.js';
import { getTranslationsForEntities, resolveLocale, DEFAULT_LOCALE } from '../../common/services/translation.service.js';

const publicFields = [
  'id', 'name', 'qualification', 'specialization', 'experienceYears',
  'studentsCount', 'assignedStudentsCount', 'status', 'avatar', 'sanad',
  'isCertified', 'isFeatured', 'isPublished', 'createdAt', 'updatedAt',
];

function presentTeacher(teacher, madrasaName, publicOnly) {
  const values = Object.fromEntries(publicFields.map((field) => [field, teacher[field]]));
  return {
    ...values,
    id: teacher.id,
    madrasaId: teacher.madrasaId,
    madrasaName,
    district: teacher.madrasa.woreda.code,
    ...(publicOnly ? {} : {
      phone: teacher.phone,
      email: teacher.email,
      salaryETB: teacher.salaryETB,
    }),
  };
}

async function mapTeachers(rows, publicOnly) {
  if (rows.length === 0) return [];
  const translations = await getTranslationsForEntities(
    'madrasa',
    [...new Set(rows.map((teacher) => teacher.madrasaId))],
    ['name']
  );
  return rows.map((teacher) => presentTeacher(
    teacher,
    resolveLocale(translations[teacher.madrasaId]?.name, DEFAULT_LOCALE) || 'Madrasa',
    publicOnly
  ));
}

export async function listTeachers(query, { publicOnly }) {
  const { page, pageSize, skip, take } = parsePagination(query);
  const { items, totalItems } = await teachersRepository.findMany({
    skip,
    take,
    search: query.search,
    madrasaId: query.madrasaId,
    status: query.status,
    publicOnly,
  });
  return {
    items: await mapTeachers(items, publicOnly),
    meta: buildPaginationMeta({ page, pageSize, totalItems }),
  };
}

export async function getTeacher(id, { publicOnly }) {
  const teacher = await teachersRepository.findById(id);
  if (!teacher || (publicOnly && !teacher.isPublished)) throw new NotFoundError('Teacher not found');
  return (await mapTeachers([teacher], publicOnly))[0];
}

async function validateMadrasa(madrasaId) {
  const madrasa = await prisma.madrasa.findUnique({ where: { id: madrasaId } });
  if (!madrasa) throw new BadRequestError('madrasaId does not reference an existing madrasa');
}

export async function createTeacher(data, actorId, ip) {
  await validateMadrasa(data.madrasaId);
  const teacher = await teachersRepository.create(data);
  await writeAuditLog({
    actorId,
    action: 'create',
    entityType: 'teacher',
    entityId: teacher.id,
    after: { name: teacher.name, madrasaId: teacher.madrasaId, isPublished: teacher.isPublished },
    ip,
  });
  return getTeacher(teacher.id, { publicOnly: false });
}

export async function updateTeacher(id, data, actorId, ip) {
  const existing = await teachersRepository.findById(id);
  if (!existing) throw new NotFoundError('Teacher not found');
  const willBePublished = data.isPublished ?? existing.isPublished;
  const willBeFeatured = data.isFeatured ?? existing.isFeatured;
  if (willBeFeatured && !willBePublished) {
    throw new BadRequestError('A featured teacher must be published to the public directory');
  }
  if (data.madrasaId !== undefined) await validateMadrasa(data.madrasaId);
  const teacher = await teachersRepository.update(id, data);
  await writeAuditLog({
    actorId,
    action: 'update',
    entityType: 'teacher',
    entityId: id,
    before: { name: existing.name, madrasaId: existing.madrasaId, isPublished: existing.isPublished },
    after: { name: teacher.name, madrasaId: teacher.madrasaId, isPublished: teacher.isPublished },
    ip,
  });
  return getTeacher(id, { publicOnly: false });
}

export async function deleteTeacher(id, actorId, ip) {
  const existing = await teachersRepository.findById(id);
  if (!existing) throw new NotFoundError('Teacher not found');
  await teachersRepository.delete(id);
  await writeAuditLog({
    actorId,
    action: 'delete',
    entityType: 'teacher',
    entityId: id,
    before: { name: existing.name, madrasaId: existing.madrasaId },
    ip,
  });
}
