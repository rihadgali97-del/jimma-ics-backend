import { createTeacherSchema } from '../src/modules/teachers/teachers.validation.js';

const teacher = {
  madrasaId: 2,
  name: 'Ustadh Example',
  qualification: 'Certified Quran instructor',
  specialization: 'Hifz and Tajweed',
  experienceYears: 5,
  studentsCount: 20,
  phone: '+251911223344',
  email: 'teacher@example.com',
  status: 'Active',
  isCertified: true,
  isFeatured: false,
  isPublished: false,
};

describe('teacher directory visibility validation', () => {
  test('allows a private, non-featured teacher record', () => {
    expect(createTeacherSchema.safeParse({ body: teacher }).success).toBe(true);
  });

  test('requires a featured teacher to be published', () => {
    const result = createTeacherSchema.safeParse({
      body: { ...teacher, isFeatured: true, isPublished: false },
    });
    expect(result.success).toBe(false);
  });

  test('allows a published featured teacher', () => {
    expect(createTeacherSchema.safeParse({
      body: { ...teacher, isFeatured: true, isPublished: true },
    }).success).toBe(true);
  });
});
