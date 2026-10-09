import { createUlemaSchema, updateUlemaSchema } from '../src/modules/ulema/ulema.validation.js';

const validProfile = {
  name: 'Scholar Example',
  title: 'Mufti',
  specializations: ['Fiqh'],
  district: 'Jimma Central',
  qualifications: ['Shariah degree'],
  languages: ['Arabic'],
  areasOfService: ['Fatwa guidance'],
  biography: 'An experienced scholar.',
  contactPhone: '+251 911 000 000',
  email: 'scholar@example.org',
  status: 'Active',
  yearsOfDawah: 12,
  isFeatured: false,
  isPublished: false,
};

describe('Ulema directory visibility validation', () => {
  test('allows private, non-featured scholar profiles', () => {
    expect(createUlemaSchema.safeParse({ body: validProfile }).success).toBe(true);
  });

  test('requires featured profiles to be published', () => {
    const result = createUlemaSchema.safeParse({
      body: { ...validProfile, isFeatured: true },
    });
    expect(result.success).toBe(false);
  });

  test('allows published featured profiles and visibility updates', () => {
    expect(createUlemaSchema.safeParse({
      body: { ...validProfile, isFeatured: true, isPublished: true },
    }).success).toBe(true);
    expect(updateUlemaSchema.safeParse({
      params: { id: '12' },
      body: { isPublished: true },
    }).success).toBe(true);
  });
});
