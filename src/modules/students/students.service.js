import { studentsRepository } from './students.repository.js';
import { BadRequestError, NotFoundError } from '../../common/errors/httpErrors.js';
import { writeAuditLog } from '../../common/utils/auditLog.js';
import { parsePagination, buildPaginationMeta } from '../../common/utils/pagination.js';
import { prisma } from '../../config/database.js';

function presentStudent(student) {
  return {
    ...student,
    madrasaName: student.madrasa.name,
    teacherId: student.teacherId || '',
    teacherName: student.teacherName || 'Not assigned',
    guardianName: student.guardianName || student.parentName,
    guardianPhone: student.guardianPhone || student.parentPhone,
  };
}

export async function listStudents(query) {
  const { page, pageSize, skip, take } = parsePagination(query);
  const { items, totalItems } = await studentsRepository.findMany({
    skip,
    take,
    search: query.search,
    madrasaId: query.madrasaId,
  });
  return {
    items: items.map(presentStudent),
    meta: buildPaginationMeta({ page, pageSize, totalItems }),
  };
}

async function validateMadrasa(madrasaId) {
  const madrasa = await prisma.madrasa.findUnique({ where: { id: madrasaId } });
  if (!madrasa) throw new BadRequestError('madrasaId does not reference an existing madrasa');
}

export async function createStudent(data, actorId, ip) {
  await validateMadrasa(data.madrasaId);
  if (data.graduationYear != null && data.status !== 'Graduated') {
    throw new BadRequestError('Only graduated students can have a graduation year');
  }
  const student = await studentsRepository.create(data);
  await writeAuditLog({
    actorId,
    action: 'create',
    entityType: 'student',
    entityId: student.id,
    after: { name: student.name, madrasaId: student.madrasaId },
    ip,
  });
  return presentStudent(student);
}

export async function updateStudent(id, data, actorId, ip) {
  const existing = await studentsRepository.findById(id);
  if (!existing) throw new NotFoundError('Student not found');
  if (data.madrasaId !== undefined) await validateMadrasa(data.madrasaId);
  const nextStatus = data.status ?? existing.status;
  const nextGraduationYear =
    data.graduationYear === undefined ? existing.graduationYear : data.graduationYear;
  if (nextGraduationYear != null && nextStatus !== 'Graduated') {
    throw new BadRequestError('Only graduated students can have a graduation year');
  }
  if (data.status === 'Graduated' && nextGraduationYear == null) {
    throw new BadRequestError('A graduation year is required for graduated students');
  }
  const student = await studentsRepository.update(id, data);
  await writeAuditLog({
    actorId,
    action: 'update',
    entityType: 'student',
    entityId: id,
    before: { name: existing.name, madrasaId: existing.madrasaId },
    after: { name: student.name, madrasaId: student.madrasaId },
    ip,
  });
  return presentStudent(student);
}
