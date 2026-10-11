import { prisma } from '../../config/database.js';

export const officialInquiriesRepository = {
  create(data) {
    return prisma.officialInquiry.create({ data });
  },

  async findMany({ skip, take, status, search }) {
    const where = {
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { referenceNumber: { contains: search } },
              { fullName: { contains: search } },
              { phone: { contains: search } },
              { email: { contains: search } },
              { inquiryType: { contains: search } },
              { department: { contains: search } },
              { message: { contains: search } },
            ],
          }
        : {}),
    };
    const [items, totalItems] = await Promise.all([
      prisma.officialInquiry.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'asc' },
      }),
      prisma.officialInquiry.count({ where }),
    ]);
    return { items, totalItems };
  },

  findById(id) {
    return prisma.officialInquiry.findUnique({ where: { id } });
  },

  findByReference(referenceNumber) {
    return prisma.officialInquiry.findUnique({ where: { referenceNumber } });
  },

  update(id, data) {
    return prisma.officialInquiry.update({ where: { id }, data });
  },
};
