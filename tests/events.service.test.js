import { jest } from '@jest/globals';

const mockRepository = {
  findMany: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  register: jest.fn(),
  findRegistrationsByEmail: jest.fn(),
  findRegistrations: jest.fn(),
  findRegistrationById: jest.fn(),
  updateRegistrationStatus: jest.fn(),
  reviewPaymentStatus: jest.fn(),
};
const mockWriteAuditLog = jest.fn();
const mockQueueEventNotifications = jest.fn();
const mockQueueRegistrationConfirmation = jest.fn();
const mockCancelQueuedEventNotifications = jest.fn();
const mockSaveEventPaymentReceipt = jest.fn();
const mockRemoveEventPaymentReceipt = jest.fn();

jest.unstable_mockModule('../src/modules/events/events.repository.js', () => ({ eventsRepository: mockRepository }));
jest.unstable_mockModule('../src/common/utils/auditLog.js', () => ({ writeAuditLog: mockWriteAuditLog }));
jest.unstable_mockModule('../src/modules/notifications/notifications.service.js', () => ({
  queueEventNotifications: mockQueueEventNotifications,
  queueRegistrationConfirmation: mockQueueRegistrationConfirmation,
  cancelQueuedEventNotifications: mockCancelQueuedEventNotifications,
}));
jest.unstable_mockModule('../src/modules/events/eventPaymentReceiptStorage.js', () => ({
  saveEventPaymentReceipt: mockSaveEventPaymentReceipt,
  removeEventPaymentReceipt: mockRemoveEventPaymentReceipt,
  getEventPaymentReceiptPath: jest.fn(),
}));

const eventsService = await import('../src/modules/events/events.service.js');
const { createEventSchema, registerForEventSchema } = await import('../src/modules/events/events.validation.js');

const event = {
  id: 42,
  title: 'Community Lecture',
  arabicTitle: null,
  category: 'Lecture',
  date: new Date('2026-11-10T00:00:00.000Z'),
  hijriDate: '1448-05-29',
  time: '09:00',
  location: 'Jimma Central Mosque',
  venueDetails: null,
  district: 'Jimma',
  organizer: 'Council',
  speaker: 'Ustadh Ahmed',
  description: 'A community lecture.',
  maxCapacity: 100,
  registeredSeats: 4,
  isFeatured: false,
  image: '',
  registrationOpen: true,
  status: 'Upcoming',
  format: null,
  entryFee: null,
  isPaid: false,
  feeAmount: 0,
  paymentInstructions: null,
  targetAudience: null,
  livestreamUrl: null,
  contactPhone: null,
  contactEmail: null,
  schedule: [],
  speakersList: [],
  tags: [],
  materials: [],
  isPublished: true,
};

beforeEach(() => jest.clearAllMocks());

describe('Events service', () => {
  it('maps database events to the public event shape', async () => {
    mockRepository.findById.mockResolvedValue(event);

    await expect(eventsService.getEvent(42)).resolves.toMatchObject({
      id: '42',
      date: '2026-11-10',
      attendeesCount: 4,
      title: 'Community Lecture',
    });
  });

  it('does not expose an unpublished event publicly', async () => {
    mockRepository.findById.mockResolvedValue({ ...event, isPublished: false });

    await expect(eventsService.getEvent(42)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('cancels queued reminders after deleting an event', async () => {
    mockRepository.findById.mockResolvedValue(event);
    mockRepository.delete.mockResolvedValue(event);

    await eventsService.deleteEvent(42, 7);

    expect(mockCancelQueuedEventNotifications).toHaveBeenCalledWith(42);
  });

  it('rejects capacity reductions below existing registrations', async () => {
    mockRepository.findById.mockResolvedValue(event);

    await expect(eventsService.updateEvent(42, { maxCapacity: 3 }, 7)).rejects.toMatchObject({ statusCode: 409 });
    expect(mockRepository.update).not.toHaveBeenCalled();
  });

  it('maps a successful registration and writes its capacity-backed pass', async () => {
    mockRepository.findById.mockResolvedValue(event);
    mockRepository.register.mockImplementation(async (_eventId, _data, passNumber) => ({
      registration: {
        id: 81,
        eventId: 42,
        event,
        fullName: 'Amina Ahmed',
        phone: '+251911234567',
        email: null,
        district: 'Jimma',
        organizationOrMadrasa: null,
        attendeesCount: 2,
        notes: null,
        passNumber,
        status: 'CONFIRMED',
        paymentStatus: 'FREE',
        createdAt: new Date('2026-10-03T10:00:00.000Z'),
      },
    }));

    const result = await eventsService.registerForEvent(42, {
      fullName: 'Amina Ahmed',
      phone: '+251911234567',
      district: 'Jimma',
      attendeesCount: 2,
    });

    expect(result).toMatchObject({ id: '81', eventId: '42', status: 'Confirmed', attendeesCount: 2 });
    expect(result.passNumber).toMatch(/^JIC-PASS-\d{4}-[A-F0-9]{10}$/);
    expect(mockRepository.register).toHaveBeenCalledWith(42, expect.objectContaining({ attendeesCount: 2 }), result.passNumber, null);
  });

  it('returns a conflict when there are not enough seats', async () => {
    mockRepository.findById.mockResolvedValue(event);
    mockRepository.register.mockResolvedValue({ full: true });

    await expect(eventsService.registerForEvent(42, {
      fullName: 'Amina Ahmed', phone: '+251911234567', district: 'Jimma', attendeesCount: 2,
    })).rejects.toMatchObject({ statusCode: 409 });
  });

  it('rejects an email already registered for the same event', async () => {
    mockRepository.findById.mockResolvedValue(event);
    mockRepository.register.mockResolvedValue({ duplicate: true });

    await expect(eventsService.registerForEvent(42, {
      fullName: 'Amina Ahmed',
      phone: '+251911234567',
      email: '  AMINA@example.com ',
      district: 'Jimma',
      attendeesCount: 1,
    })).rejects.toMatchObject({ statusCode: 409 });

    expect(mockRepository.register).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ email: 'amina@example.com' }),
      expect.any(String),
      null
    );
    expect(mockQueueRegistrationConfirmation).not.toHaveBeenCalled();
  });

  it('stores a charged registration as pending and does not issue a pass before approval', async () => {
    const paidEvent = { ...event, isPaid: true, feeAmount: 250, paymentInstructions: 'Pay to Council account' };
    mockRepository.findById.mockResolvedValue(paidEvent);
    mockSaveEventPaymentReceipt.mockResolvedValue({
      filename: 'receipt.pdf',
      mimeType: 'application/pdf',
      filepath: '/private/receipt.pdf',
    });
    mockRepository.register.mockImplementation(async (_eventId, _data, _passNumber, receipt) => ({
      registration: {
        id: 91,
        eventId: 42,
        event: paidEvent,
        fullName: 'Amina Ahmed',
        phone: '+251911234567',
        email: 'amina@example.com',
        district: 'Jimma',
        attendeesCount: 1,
        passNumber: null,
        status: 'CONFIRMED',
        paymentStatus: 'PENDING',
        paymentReceiptFilename: receipt.filename,
        paymentReceiptMimeType: receipt.mimeType,
        createdAt: new Date('2026-10-03T10:00:00.000Z'),
      },
    }));

    const result = await eventsService.registerForEvent(42, {
      fullName: 'Amina Ahmed',
      phone: '+251911234567',
      email: 'AMINA@example.com',
      district: 'Jimma',
      attendeesCount: 1,
    }, { mimetype: 'application/pdf', buffer: Buffer.from('%PDF-') });

    expect(result).toMatchObject({ paymentStatus: 'PENDING', hasPaymentReceipt: true });
    expect(result.passNumber).toBeUndefined();
    expect(mockRepository.register).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ email: 'amina@example.com' }),
      expect.any(String),
      expect.objectContaining({ filename: 'receipt.pdf' })
    );
    expect(mockQueueRegistrationConfirmation).not.toHaveBeenCalled();
  });

  it('does not create a paid registration without an email and receipt', async () => {
    mockRepository.findById.mockResolvedValue({
      ...event,
      isPaid: true,
      feeAmount: 250,
      paymentInstructions: 'Pay to Council account',
    });

    await expect(eventsService.registerForEvent(42, {
      fullName: 'Amina Ahmed',
      phone: '+251911234567',
      district: 'Jimma',
      attendeesCount: 1,
    })).rejects.toMatchObject({ statusCode: 400 });
    expect(mockSaveEventPaymentReceipt).not.toHaveBeenCalled();
    expect(mockRepository.register).not.toHaveBeenCalled();
  });

  it('issues a pass only when an administrator approves a pending payment', async () => {
    mockRepository.reviewPaymentStatus.mockImplementation(async (_id, paymentStatus, passNumber) => ({
      registration: {
        id: 91,
        eventId: 42,
        event,
        fullName: 'Amina Ahmed',
        phone: '+251911234567',
        email: 'amina@example.com',
        district: 'Jimma',
        attendeesCount: 1,
        passNumber,
        status: 'CONFIRMED',
        paymentStatus,
        paymentReceiptFilename: 'receipt.pdf',
        createdAt: new Date('2026-10-03T10:00:00.000Z'),
      },
    }));

    const registration = await eventsService.reviewEventPayment(91, 'APPROVED', 7);

    expect(registration.paymentStatus).toBe('APPROVED');
    expect(registration.passNumber).toMatch(/^JIC-PASS-\d{4}-[A-F0-9]{10}$/);
    expect(mockRepository.reviewPaymentStatus).toHaveBeenCalledWith(91, 'APPROVED', registration.passNumber);
    expect(mockQueueRegistrationConfirmation).toHaveBeenCalledTimes(1);
  });

  it('returns matching active passes using normalized email and phone', async () => {
    mockRepository.findRegistrationsByEmail.mockResolvedValue([
      {
        id: 81,
        eventId: 42,
        event,
        fullName: 'Amina Ahmed',
        phone: '+251 (911) 234-567',
        email: 'amina@example.com',
        district: 'Jimma',
        organizationOrMadrasa: null,
        attendeesCount: 1,
        notes: null,
        passNumber: 'JIC-PASS-2026-ABCDEF1234',
        status: 'CONFIRMED',
        createdAt: new Date('2026-10-03T12:00:00.000Z'),
      },
      {
        id: 82,
        eventId: 42,
        event,
        fullName: 'Amina Ahmed',
        phone: '+251 911 234 567',
        email: 'amina@example.com',
        district: 'Jimma',
        attendeesCount: 1,
        passNumber: 'JIC-PASS-2026-ABCDEF1235',
        status: 'CONFIRMED',
        createdAt: new Date('2026-10-03T11:00:00.000Z'),
      },
      {
        id: 83,
        eventId: 43,
        event: { ...event, id: 43, title: 'Paid Workshop' },
        fullName: 'Amina Ahmed',
        phone: '+251 911 234 567',
        email: 'amina@example.com',
        district: 'Jimma',
        attendeesCount: 1,
        passNumber: null,
        status: 'CANCELLED',
        paymentStatus: 'REJECTED',
        createdAt: new Date('2026-10-03T13:00:00.000Z'),
      },
    ]);

    const results = await eventsService.findMyEventRegistrations({
      email: ' AMINA@example.com ',
      phone: '+251 911 234 567',
    });

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({ id: '81', status: 'Confirmed' });
    expect(results[1]).toMatchObject({
      id: '83',
      eventTitle: 'Paid Workshop',
      status: 'Cancelled',
      paymentStatus: 'REJECTED',
    });
    expect(mockRepository.findRegistrationsByEmail).toHaveBeenCalledWith('amina@example.com');
  });
});

describe('Events request validation', () => {
  const requiredEvent = {
    title: 'Community Lecture', category: 'Lecture', date: '2026-11-10', hijriDate: '', time: '09:00',
    location: 'Jimma Central Mosque', district: 'Jimma', organizer: '', speaker: '',
    description: 'A community lecture.', maxCapacity: 100, image: '', schedule: [], speakersList: [], tags: [], materials: [],
  };

  it('rejects impossible calendar dates', () => {
    expect(createEventSchema.safeParse({ body: { ...requiredEvent, date: '2026-02-30' } }).success).toBe(false);
  });

  it('rejects registrations with invalid phone numbers or seat counts', () => {
    const result = registerForEventSchema.safeParse({
      params: { id: '42' },
      body: { fullName: 'Amina Ahmed', phone: 'phone', district: 'Jimma', attendeesCount: 0 },
    });
    expect(result.success).toBe(false);
  });

  it('normalizes registration emails and validates pass lookup contacts', () => {
    const registration = registerForEventSchema.parse({
      params: { id: '42' },
      body: {
        fullName: 'Amina Ahmed',
        phone: '+251911234567',
        email: ' AMINA@example.com ',
        district: 'Jimma',
        attendeesCount: 1,
      },
    });
    expect(registration.body.email).toBe('amina@example.com');
  });

  it('requires amount and payment instructions for charged events', () => {
    expect(createEventSchema.safeParse({
      body: { ...requiredEvent, isPaid: true, feeAmount: 0, paymentInstructions: '' },
    }).success).toBe(false);
  });
});
