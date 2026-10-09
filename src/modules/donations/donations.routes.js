import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { validate } from '../../common/middlewares/validate.js';
import { strictRateLimiter } from '../../common/middlewares/rateLimiter.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { sendCreated, sendSuccess } from '../../common/utils/apiResponse.js';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { authorizeAny } from '../../common/middlewares/authorize.js';

export const donationsPublicRouter = Router();
export const donationsAdminRouter = Router();

const schema = z.object({ body: z.object({
  donorName: z.string().trim().max(150).optional(),
  donorPhone: z.string().trim().regex(/^[0-9+()\\-\\s]{7,30}$/),
  donorEmail: z.string().trim().email().max(255).optional().or(z.literal('')),
  anonymous: z.boolean().default(false),
  amountETB: z.coerce.number().positive().max(100000000),
  fundName: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(80),
  paymentMethod: z.enum(['TELEBIRR', 'CBE_BIRR', 'AWASH_BANK', 'BANK_TRANSFER']),
}) });

donationsAdminRouter.use(authenticate, authorizeAny('finance.write', 'zakat.manage'));
donationsAdminRouter.get('/intents', asyncHandler(async (_req, res) => {
  const rows = await prisma.donationIntent.findMany({
    orderBy: { createdAt: 'desc' },
  });
  sendSuccess(res, { data: rows.map((row) => ({
    ...row,
    id: String(row.id),
    amountETB: Number(row.amountETB),
  })) });
}));

donationsPublicRouter.post('/', strictRateLimiter({ windowMs: 60 * 60 * 1000, max: 10 }), validate(schema), asyncHandler(async (req, res) => {
  const data = req.body;
  const ref = `DON-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const row = await prisma.donationIntent.create({ data: {
    reference: ref,
    donorName: data.anonymous ? null : data.donorName || null,
    donorPhone: data.donorPhone,
    donorEmail: data.donorEmail || null,
    anonymous: data.anonymous,
    amountETB: data.amountETB,
    fundName: data.fundName,
    category: data.category,
    paymentMethod: data.paymentMethod,
  } });
  sendCreated(res, { reference: row.reference, status: row.status, amountETB: Number(row.amountETB), fundName: row.fundName, paymentMethod: row.paymentMethod, createdAt: row.createdAt });
}));
