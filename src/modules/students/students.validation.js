import { z, paginationQuerySchema, idParamSchema } from '../../common/validation/shared.js';

const hifzStatusSchema = z.object({
  sabaq: z.string().trim().max(500),
  sabqi: z.string().trim().max(500),
  manzil: z.string().trim().max(500),
});

const studentFields = {
  name: z.string().trim().min(2).max(180),
  arabicName: z.string().trim().max(180).nullable().optional(),
  gender: z.enum(['Male', 'Female']),
  age: z.coerce.number().int().min(5).max(30),
  madrasaId: z.coerce.number().int().positive(),
  className: z.string().trim().min(1).max(180),
  teacherId: z.string().trim().max(80).nullable().optional(),
  teacherName: z.string().trim().max(180).nullable().optional(),
  enrollmentDate: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  attendanceRate: z.coerce.number().min(0).max(100),
  quranJuzCompleted: z.coerce.number().int().min(0).max(30),
  currentJuz: z.coerce.number().int().min(1).max(30),
  currentJuzProgress: z.coerce.number().min(0).max(100),
  hifzStatus: hifzStatusSchema,
  tajweedRating: z.enum(['Excellent', 'Good', 'Needs Practice', 'Very Good', 'Needs Revision']),
  examScoreAvg: z.coerce.number().min(0).max(100),
  parentName: z.string().trim().min(1).max(180),
  parentPhone: z.string().trim().min(6).max(40),
  guardianName: z.string().trim().max(180).nullable().optional(),
  guardianPhone: z.string().trim().max(40).nullable().optional(),
  sabaqSurah: z.string().trim().max(180).nullable().optional(),
  sabaqAyahStart: z.coerce.number().int().positive().nullable().optional(),
  sabaqAyahEnd: z.coerce.number().int().positive().nullable().optional(),
  sabaqiJuz: z.coerce.number().int().min(1).max(30).nullable().optional(),
  manzilJuz: z.string().trim().max(180).nullable().optional(),
  dailyAttendance: z.enum(['Present', 'Absent', 'Late', 'Excused']).nullable().optional(),
  level: z.string().trim().max(180).nullable().optional(),
  status: z.enum(['Active', 'On Leave', 'Graduated']),
  graduationYear: z.coerce.number().int().min(1900).max(2200).nullable().optional(),
  avatar: z.string().url().max(1000).nullable().optional(),
};

export const listStudentsSchema = z.object({
  query: paginationQuerySchema.extend({
    search: z.string().trim().min(1).optional(),
    madrasaId: z.coerce.number().int().positive().optional(),
  }),
});

export const studentIdParamSchema = z.object({ params: idParamSchema });
export const createStudentSchema = z.object({ body: z.object(studentFields) });
export const updateStudentSchema = z.object({
  params: idParamSchema,
  body: z.object(studentFields).partial().refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  }),
});
