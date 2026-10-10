import { z, idParamSchema, paginationQuerySchema } from '../../common/validation/shared.js';

const categories = [
  'Lecture', 'Quran Competition', 'Ramadan Program', 'Ulema Conference',
  'Youth Workshop', 'Community Gathering',
];
const eventStatuses = ['Upcoming', 'In Progress', 'Completed', 'Postponed', 'Cancelled'];
const formats = ['In-Person', 'Hybrid', 'Live Stream'];
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD for the event date')
  .refine((value) => {
    const timestamp = Date.parse(`${value}T00:00:00.000Z`);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
  }, {
    message: 'Enter a valid calendar date',
  });
const scheduleItem = z.object({
  time: z.string().trim().min(1).max(100),
  activity: z.string().trim().min(1).max(240),
  speaker: z.string().trim().max(200).optional(),
  hall: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
});
const speakerItem = z.object({
  name: z.string().trim().min(1).max(180),
  title: z.string().trim().max(180),
  role: z.string().trim().max(180),
  avatar: z.string().max(1000).optional(),
  organization: z.string().trim().max(200).optional(),
});
const materialItem = z.object({
  title: z.string().trim().min(1).max(180),
  fileType: z.string().trim().max(30),
  size: z.string().trim().max(30),
  downloadUrl: z.string().url().optional(),
});

const eventFields = {
  title: z.string().trim().min(3).max(240),
  arabicTitle: z.string().trim().max(240).optional(),
  category: z.enum(categories),
  date: dateString,
  hijriDate: z.string().trim().max(100).default(''),
  time: z.string().trim().min(1).max(100),
  location: z.string().trim().min(2).max(240),
  venueDetails: z.string().trim().max(500).optional(),
  district: z.string().trim().min(1).max(150),
  organizer: z.string().trim().max(200).default(''),
  speaker: z.string().trim().max(200).default(''),
  description: z.string().trim().min(1).max(10000),
  maxCapacity: z.coerce.number().int().positive().max(1000000),
  isFeatured: z.boolean().default(false),
  image: z.string().max(1000).default(''),
  registrationOpen: z.boolean().default(true),
  status: z.enum(eventStatuses).default('Upcoming'),
  format: z.enum(formats).optional(),
  entryFee: z.string().trim().max(100).optional(),
  isPaid: z.boolean().default(false),
  feeAmount: z.coerce.number().finite().min(0).max(100000000).default(0),
  paymentInstructions: z.string().trim().max(2000).optional(),
  targetAudience: z.string().trim().max(500).optional(),
  livestreamUrl: z.string().url().optional().or(z.literal('')),
  contactPhone: z.string().trim().max(30).optional(),
  contactEmail: z.string().email().max(255).optional().or(z.literal('')),
  schedule: z.array(scheduleItem).max(100).default([]),
  speakersList: z.array(speakerItem).max(100).default([]),
  tags: z.array(z.string().trim().min(1).max(60)).max(50).default([]),
  materials: z.array(materialItem).max(100).default([]),
};

export const listEventsSchema = z.object({
  query: paginationQuerySchema.extend({
    search: z.string().trim().min(1).optional(),
    category: z.enum(categories).optional(),
    district: z.string().trim().min(1).optional(),
    status: z.enum(eventStatuses).optional(),
  }),
});
export const eventIdParamSchema = z.object({ params: idParamSchema });
export const createEventSchema = z.object({
  body: z.object(eventFields).refine(
    (data) => !data.isPaid || (data.feeAmount > 0 && Boolean(data.paymentInstructions?.trim())),
    { message: 'Charged events require a positive ETB amount and payment instructions' }
  ),
});
export const updateEventSchema = z.object({
  params: idParamSchema,
  body: z.object(Object.fromEntries(Object.entries(eventFields).map(([key, schema]) => [key, schema.optional()])))
    .refine((data) => Object.keys(data).length > 0, { message: 'At least one field must be provided' })
    .refine((data) => data.feeAmount === undefined || data.feeAmount >= 0, { message: 'Event fee cannot be negative' }),
});
export const listEventRegistrationsSchema = z.object({
  query: paginationQuerySchema.extend({ eventId: z.coerce.number().int().positive().optional() }),
});
export const registerForEventSchema = z.object({
  params: idParamSchema,
  body: z.object({
    fullName: z.string().trim().min(2).max(180),
    phone: z.string().trim().regex(/^[0-9+()\-\s]{7,30}$/),
    email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
    district: z.string().trim().min(1).max(150),
    organizationOrMadrasa: z.string().trim().max(200).optional(),
    attendeesCount: z.coerce.number().int().positive().max(100),
    notes: z.string().trim().max(2000).optional(),
  }),
});
export const findMyEventRegistrationsSchema = z.object({
  body: z.object({
    email: z.string().trim().email().max(255).transform((value) => value.toLowerCase()),
    phone: z.string().trim().regex(/^[0-9+()\-\s]{7,30}$/),
  }),
});
export const updateRegistrationSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({ status: z.enum(['CHECKED_IN', 'CANCELLED']) }),
});
export const reviewEventPaymentSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive() }),
  body: z.object({ paymentStatus: z.enum(['APPROVED', 'REJECTED']) }),
});
