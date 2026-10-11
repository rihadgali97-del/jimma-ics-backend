import { z, idParamSchema, paginationQuerySchema } from '../../common/validation/shared.js';

const statuses = ['SUBMITTED', 'UNDER_REVIEW', 'COMPLETED', 'CANCELLED'];
const inquiryTypes = ['General', 'Counselling', 'Zakat', 'Madrasa', 'Fatwa', 'Mosque'];
const departments = [
  'General Secretariat',
  'Madrasa Education Board',
  'Zakat & Waqf Affairs',
  'Ulema & Fatwa Advisory Panel',
  'Civic Services Registration',
  'Mosque Expansion & Engineering',
];

const phoneSchema = z.string().trim().regex(/^[0-9+()\-\s]{7,30}$/, 'Enter a valid phone number');

export const submitOfficialInquirySchema = z.object({
  body: z.object({
    fullName: z.string().trim().min(2).max(150),
    phone: phoneSchema,
    email: z.union([z.string().trim().email().max(255), z.literal('')]).optional(),
    inquiryType: z.enum(inquiryTypes),
    department: z.enum(departments),
    message: z.string().trim().min(10).max(5000),
  }),
});

export const listOfficialInquiriesSchema = z.object({
  query: paginationQuerySchema.extend({
    status: z.enum(statuses).optional(),
    search: z.string().trim().min(1).optional(),
  }),
});

export const updateOfficialInquiryStatusSchema = z.object({
  params: idParamSchema,
  body: z.object({ status: z.enum(statuses) }),
});
