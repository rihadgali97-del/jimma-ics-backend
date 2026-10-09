import { PrismaClient } from '@prisma/client';
import { env, isProduction } from './env.js';
import { logger } from '../common/utils/logger.js';

// Single shared Prisma instance for the whole process. Never instantiate
// PrismaClient anywhere else — repositories import this.
export const prisma = new PrismaClient({
  log: isProduction ? ['error', 'warn'] : ['warn', 'error'],
});

export async function connectDatabase() {
  await prisma.$connect();
  logger.info(`Connected to MySQL (env: ${env.NODE_ENV})`);
}

export async function disconnectDatabase() {
  await prisma.$disconnect();
}