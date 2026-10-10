import { randomUUID } from 'node:crypto';
import { eventsRepository } from './events.repository.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../common/errors/httpErrors.js';
import { writeAuditLog } from '../../common/utils/auditLog.js';
import { parsePagination, buildPaginationMeta } from '../../common/utils/pagination.js';
import { logger } from '../../common/utils/logger.js';
import {
  queueEventNotifications,
  queueRegistrationConfirmation,
  cancelQueuedEventNotifications,
} from '../notifications/notifications.service.js';
import {
  getEventPaymentReceiptPath,
  removeEventPaymentReceipt,
  saveEventPaymentReceipt,
} from './eventPaymentReceiptStorage.js';

async function queueEventSideEffect(operation, eventId, operationName) {
  try {
    await operation();
  } catch (err) {
    logger.error({ err, eventId }, `${operationName} failed after the event change was saved`);
  }
}

function toCouncilEvent(event) {
  return {
    id: String(event.id),
    title: event.title,
    arabicTitle: event.arabicTitle ?? undefined,
    category: event.category,
    date: event.date.toISOString().slice(0, 10),
    hijriDate: event.hijriDate,
    time: event.time,
    location: event.location,
    venueDetails: event.venueDetails ?? undefined,
    district: event.district,
    organizer: event.organizer,
    speaker: event.speaker,
    description: event.description,
    attendeesCount: event.registeredSeats,
    maxCapacity: event.maxCapacity,
    isFeatured: event.isFeatured,
    image: event.image,
    registrationOpen: event.registrationOpen,
    status: event.status,
    format: event.format ?? undefined,
    entryFee: event.isPaid ? `${event.feeAmount} ETB` : (event.entryFee || 'Free Admission'),
    isPaid: event.isPaid,
    feeAmount: Number(event.feeAmount),
    paymentInstructions: event.paymentInstructions ?? undefined,
    targetAudience: event.targetAudience ?? undefined,
    livestreamUrl: event.livestreamUrl ?? undefined,
    contactPhone: event.contactPhone ?? undefined,
    contactEmail: event.contactEmail ?? undefined,
    schedule: event.schedule ?? [],
    speakersList: event.speakersList ?? [],
    tags: event.tags ?? [],
    materials: event.materials ?? [],
  };
}

function toEventRegistration(registration) {
  return {
    id: String(registration.id),
    eventId: String(registration.eventId),
    eventTitle: registration.event.title,
    eventDate: registration.event.date.toISOString().slice(0, 10),
    fullName: registration.fullName,
    phone: registration.phone,
    email: registration.email ?? undefined,
    district: registration.district,
    organizationOrMadrasa: registration.organizationOrMadrasa ?? undefined,
    attendeesCount: registration.attendeesCount,
    notes: registration.notes ?? undefined,
    passNumber: registration.passNumber ?? undefined,
    paymentStatus: registration.paymentStatus,
    hasPaymentReceipt: Boolean(registration.paymentReceiptFilename),
    status: registration.status === 'CHECKED_IN' ? 'Checked-In'
      : registration.status === 'CANCELLED' ? 'Cancelled' : 'Confirmed',
    createdAt: registration.createdAt.toISOString(),
  };
}

function toEventData(data) {
  const { date, ...fields } = data;
  return { ...fields, date: new Date(`${date}T00:00:00.000Z`) };
}

export async function listEvents(query, { publicOnly = true } = {}) {
  const { page, pageSize, skip, take } = parsePagination(query);
  const { items, totalItems } = await eventsRepository.findMany({
    skip, take, search: query.search, category: query.category,
    district: query.district, status: query.status, publicOnly,
  });
  return { items: items.map(toCouncilEvent), meta: buildPaginationMeta({ page, pageSize, totalItems }) };
}

export async function getEvent(id, { publicOnly = true } = {}) {
  const event = await eventsRepository.findById(id);
  if (!event || (publicOnly && !event.isPublished)) throw new NotFoundError('Event not found');
  return toCouncilEvent(event);
}

export async function createEvent(data, actorId) {
  if (data.isPaid && (!(data.feeAmount > 0) || !data.paymentInstructions?.trim())) {
    throw new BadRequestError('Charged events require a positive ETB amount and payment instructions');
  }
  const eventData = {
    ...data,
    feeAmount: data.isPaid ? data.feeAmount : 0,
    paymentInstructions: data.isPaid ? data.paymentInstructions.trim() : null,
  };
  const event = await eventsRepository.create(toEventData(eventData));
  await writeAuditLog({ actorId, action: 'create', entityType: 'council_event', entityId: event.id, after: { title: event.title } });
  if (event.isPublished) {
    await queueEventSideEffect(() => queueEventNotifications(event), event.id, 'Queueing event notifications');
  }
  return toCouncilEvent(event);
}

export async function updateEvent(id, data, actorId) {
  const existing = await eventsRepository.findById(id);
  if (!existing) throw new NotFoundError('Event not found');
  if (data.maxCapacity !== undefined && data.maxCapacity < existing.registeredSeats) {
    throw new ConflictError('Capacity cannot be lower than the number of seats already reserved');
  }
  const nextIsPaid = data.isPaid ?? existing.isPaid;
  const existingFeeAmount = Number(existing.feeAmount);
  const nextFeeAmount = data.feeAmount ?? existingFeeAmount;
  const nextInstructions = data.paymentInstructions ?? existing.paymentInstructions;
  if (nextIsPaid && (!(nextFeeAmount > 0) || !nextInstructions?.trim())) {
    throw new BadRequestError('Charged events require a positive ETB amount and payment instructions');
  }
  if (existing.registeredSeats > 0 && (
    (data.isPaid !== undefined && data.isPaid !== existing.isPaid) ||
    (data.feeAmount !== undefined && data.feeAmount !== existingFeeAmount) ||
    (data.paymentInstructions !== undefined && data.paymentInstructions !== existing.paymentInstructions)
  )) {
    throw new ConflictError('Payment terms cannot be changed after attendees have reserved seats');
  }
  const eventData = {
    ...data,
    ...(data.isPaid === false ? { feeAmount: 0, paymentInstructions: null } : {}),
    ...(data.paymentInstructions !== undefined ? { paymentInstructions: data.paymentInstructions.trim() || null } : {}),
  };
  const event = await eventsRepository.update(id, eventData.date ? toEventData(eventData) : eventData);
  await writeAuditLog({ actorId, action: 'update', entityType: 'council_event', entityId: id, after: data });
  const changedNotificationFields = ['title', 'category', 'date', 'time', 'location', 'district', 'description', 'status', 'isPublished'];
  const notificationRelevantChange = changedNotificationFields.some(
    (field) => data[field] !== undefined && data[field] !== existing[field]
  );
  if (notificationRelevantChange) {
    await queueEventSideEffect(async () => {
      await cancelQueuedEventNotifications(id);
      if (event.isPublished) {
        await queueEventNotifications(event, { reason: event.status === 'Cancelled' ? 'cancelled' : 'updated' });
      }
    }, id, 'Rescheduling event notifications');
  }
  return toCouncilEvent(event);
}

export async function deleteEvent(id, actorId) {
  const existing = await eventsRepository.findById(id);
  if (!existing) throw new NotFoundError('Event not found');
  await eventsRepository.delete(id);
  await queueEventSideEffect(
    () => cancelQueuedEventNotifications(id),
    id,
    'Cancelling notifications for deleted event'
  );
  await writeAuditLog({ actorId, action: 'delete', entityType: 'council_event', entityId: id, after: { title: existing.title } });
}

export async function registerForEvent(eventId, data, receiptFile) {
  const passNumber = `JIC-PASS-${new Date().getFullYear()}-${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
  const registrationData = {
    ...data,
    ...(data.email ? { email: data.email.trim().toLowerCase() } : {}),
  };
  const event = await eventsRepository.findById(eventId);
  if (!event || !event.isPublished || !event.registrationOpen || event.status === 'Cancelled') {
    throw new NotFoundError('Event not found or registration is closed');
  }
  if (!registrationData.email) {
    throw new BadRequestError('An email address is required for event registration');
  }
  if (event.isPaid && !receiptFile) {
    throw new BadRequestError('Attach your payment receipt to submit a paid event registration');
  }
  if (!event.isPaid && receiptFile) {
    throw new BadRequestError('Receipts can only be submitted for charged events');
  }

  const receipt = event.isPaid ? await saveEventPaymentReceipt(receiptFile) : null;
  let result;
  try {
    result = await eventsRepository.register(eventId, registrationData, passNumber, receipt);
  } catch (error) {
    if (receipt) await removeEventPaymentReceipt(receipt.filepath);
    throw error;
  }
  if (!result || result.duplicate || result.full || result.paymentRequired || result.unexpectedReceipt) {
    if (receipt) await removeEventPaymentReceipt(receipt.filepath);
  }
  if (!result) throw new NotFoundError('Event not found or registration is closed');
  if (result.duplicate) throw new ConflictError('This email is already registered for this event');
  if (result.full) throw new ConflictError('There are not enough seats remaining for this registration');
  if (result.paymentRequired) throw new BadRequestError('A payment receipt is required for this charged event');
  if (result.unexpectedReceipt) throw new BadRequestError('This event does not accept payment receipts');

  if (result.registration.paymentStatus === 'FREE') {
    await queueEventSideEffect(
      () => queueRegistrationConfirmation(result.registration),
      result.registration.eventId,
      'Queueing event registration confirmation'
    );
  }
  return toEventRegistration(result.registration);
}

function normalizePhone(phone) {
  return phone.replace(/\D/g, '');
}

export async function findMyEventRegistrations({ email, phone }) {
  const registrations = await eventsRepository.findRegistrationsByEmail(email.trim().toLowerCase());
  const normalizedPhone = normalizePhone(phone);
  const matchingRegistrations = registrations.filter(
    (registration) => normalizePhone(registration.phone) === normalizedPhone
  );
  const seenEvents = new Set();
  return matchingRegistrations
    .filter((registration) => {
      if (seenEvents.has(registration.eventId)) return false;
      seenEvents.add(registration.eventId);
      return true;
    })
    .map(toEventRegistration);
}

export async function listEventRegistrations(query) {
  const { page, pageSize, skip, take } = parsePagination(query);
  const { items, totalItems } = await eventsRepository.findRegistrations({ skip, take, eventId: query.eventId });
  return { items: items.map(toEventRegistration), meta: buildPaginationMeta({ page, pageSize, totalItems }) };
}

export async function updateRegistrationStatus(id, status, actorId) {
  const result = await eventsRepository.updateRegistrationStatus(id, status);
  if (!result) throw new NotFoundError('Event registration not found');
  if (result.paymentPending) throw new ConflictError('Payment must be approved before checking in this attendee');
  await writeAuditLog({
    actorId,
    action: status === 'CHECKED_IN' ? 'check_in' : 'cancel',
    entityType: 'event_registration',
    entityId: id,
    after: { status },
  });
  return toEventRegistration(result.registration);
}

export async function reviewEventPayment(id, paymentStatus, actorId) {
  const passNumber = paymentStatus === 'APPROVED'
    ? `JIC-PASS-${new Date().getFullYear()}-${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`
    : undefined;
  const result = await eventsRepository.reviewPaymentStatus(id, paymentStatus, passNumber);
  if (!result) throw new NotFoundError('Event registration not found');
  if (result.notPending) throw new ConflictError('Only registrations awaiting payment review can be approved or rejected');

  if (paymentStatus === 'APPROVED') {
    await queueEventSideEffect(
      () => queueRegistrationConfirmation(result.registration),
      result.registration.eventId,
      'Queueing approved event registration confirmation'
    );
  }
  await writeAuditLog({
    actorId,
    action: paymentStatus === 'APPROVED' ? 'approve_payment' : 'reject_payment',
    entityType: 'event_registration',
    entityId: id,
    after: { paymentStatus },
  });
  return toEventRegistration(result.registration);
}

export async function getEventPaymentReceipt(id) {
  const registration = await eventsRepository.findRegistrationById(id);
  if (!registration?.paymentReceiptFilename) throw new NotFoundError('Payment receipt not found');
  return {
    path: getEventPaymentReceiptPath(registration.paymentReceiptFilename),
    mimeType: registration.paymentReceiptMimeType || 'application/octet-stream',
  };
}
