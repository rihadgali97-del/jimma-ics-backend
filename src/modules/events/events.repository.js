import { prisma } from '../../config/database.js';

export const eventsRepository = {
  async findMany({ skip, take, search, category, district, status, publicOnly }) {
    const where = {
      ...(publicOnly ? { isPublished: true } : {}),
      ...(category ? { category } : {}),
      ...(district ? { district: { contains: district } } : {}),
      ...(status ? { status } : {}),
      ...(search ? {
        OR: [
          { title: { contains: search } },
          { arabicTitle: { contains: search } },
          { location: { contains: search } },
          { speaker: { contains: search } },
          { description: { contains: search } },
        ],
      } : {}),
    };
    const [items, totalItems] = await Promise.all([
      prisma.councilEvent.findMany({ where, skip, take, orderBy: [{ date: 'asc' }, { id: 'desc' }] }),
      prisma.councilEvent.count({ where }),
    ]);
    return { items, totalItems };
  },

  findById(id) {
    return prisma.councilEvent.findUnique({ where: { id } });
  },

  create(data) {
    return prisma.councilEvent.create({ data });
  },

  update(id, data) {
    return prisma.councilEvent.update({ where: { id }, data });
  },

  delete(id) {
    return prisma.councilEvent.delete({ where: { id } });
  },

  async register(eventId, data, passNumber, receipt) {
    return prisma.$transaction(async (tx) => {
      // Lock the event row to serialize simultaneous reservations and protect capacity.
      const locked = await tx.$queryRaw`SELECT id FROM council_events WHERE id = ${eventId} FOR UPDATE`;
      if (locked.length === 0) return null;
      const event = await tx.councilEvent.findUnique({ where: { id: eventId } });
      if (!event || !event.isPublished || !event.registrationOpen || event.status === 'Cancelled') return null;
      if (event.isPaid && (!data.email || !receipt?.filename)) return { paymentRequired: true };
      if (!event.isPaid && receipt?.filename) return { unexpectedReceipt: true };
      if (data.email) {
        const existingRegistration = await tx.eventRegistration.findFirst({
          where: { eventId, email: data.email, status: { not: 'CANCELLED' } },
          select: { id: true },
        });
        if (existingRegistration) return { duplicate: true };
      }
      if (event.registeredSeats + data.attendeesCount > event.maxCapacity) return { full: true };

      await tx.councilEvent.update({
        where: { id: eventId },
        data: { registeredSeats: { increment: data.attendeesCount } },
      });
      const registration = await tx.eventRegistration.create({
        data: {
          ...data,
          eventId,
          passNumber: event.isPaid ? null : passNumber,
          paymentStatus: event.isPaid ? 'PENDING' : 'FREE',
          paymentReceiptFilename: event.isPaid ? receipt.filename : null,
          paymentReceiptMimeType: event.isPaid ? receipt.mimeType : null,
        },
        include: { event: true },
      });
      return { registration };
    });
  },

  async findRegistrations({ skip, take, eventId }) {
    const where = eventId ? { eventId } : {};
    const [items, totalItems] = await Promise.all([
      prisma.eventRegistration.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { event: true },
      }),
      prisma.eventRegistration.count({ where }),
    ]);
    return { items, totalItems };
  },

  findRegistrationsByEmail(email) {
    return prisma.eventRegistration.findMany({
      where: {
        email,
        OR: [
          { status: { not: 'CANCELLED' } },
          { paymentStatus: 'REJECTED' },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { event: true },
    });
  },

  findRegistrationById(id) {
    return prisma.eventRegistration.findUnique({ where: { id }, include: { event: true } });
  },

  async updateRegistrationStatus(id, status) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.eventRegistration.findUnique({ where: { id } });
      if (!existing) return null;
      if (existing.status === 'CANCELLED') return { unchanged: true, registration: existing };
      if (status === 'CHECKED_IN' && existing.paymentStatus === 'PENDING') {
        return { paymentPending: true, registration: existing };
      }
      if (status === 'CANCELLED') {
        const changed = await tx.eventRegistration.updateMany({
          where: { id, status: { not: 'CANCELLED' } },
          data: { status: 'CANCELLED' },
        });
        if (changed.count) {
          await tx.councilEvent.update({
            where: { id: existing.eventId },
            data: { registeredSeats: { decrement: existing.attendeesCount } },
          });
        }
      } else {
        await tx.eventRegistration.update({
          where: { id },
          data: { status: 'CHECKED_IN', checkedInAt: new Date() },
        });
      }
      return { registration: await tx.eventRegistration.findUnique({ where: { id }, include: { event: true } }) };
    });
  },

  async reviewPaymentStatus(id, paymentStatus, passNumber) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM event_registrations WHERE id = ${id} FOR UPDATE`;
      const existing = await tx.eventRegistration.findUnique({ where: { id } });
      if (!existing) return null;
      if (existing.paymentStatus !== 'PENDING' || existing.status === 'CANCELLED') {
        return { notPending: true, registration: existing };
      }

      if (paymentStatus === 'REJECTED') {
        await tx.eventRegistration.update({
          where: { id },
          data: { paymentStatus: 'REJECTED', status: 'CANCELLED' },
        });
        await tx.councilEvent.update({
          where: { id: existing.eventId },
          data: { registeredSeats: { decrement: existing.attendeesCount } },
        });
      } else {
        await tx.eventRegistration.update({
          where: { id },
          data: { paymentStatus: 'APPROVED', passNumber },
        });
      }
      return {
        registration: await tx.eventRegistration.findUnique({ where: { id }, include: { event: true } }),
      };
    });
  },
};
