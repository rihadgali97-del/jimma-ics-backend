import { prisma } from '../../config/database.js';

// Produces human-readable, trackable reference numbers like "ZKT-2026-00042".
// The prefix identifies which service the reference belongs to, which is
// what lets the unified /track/:reference endpoint (modules/tracker) figure
// out which table to look in without the caller specifying a type.
export const SERVICE_CODES = {
  zakat: 'ZKT',
  janazah: 'JNZ',
};

/**
 * Atomically increments (or creates) this service's counter for the current
 * year and returns the next reference number. Uses a raw MySQL upsert
 * (INSERT ... ON DUPLICATE KEY UPDATE) rather than read-then-write, so
 * concurrent submissions can never receive the same number.
 */
export async function generateReferenceNumber(serviceCode) {
  const year = new Date().getFullYear();

  await prisma.$executeRaw`
    INSERT INTO reference_sequences (service_code, year, last_number)
    VALUES (${serviceCode}, ${year}, 1)
    ON DUPLICATE KEY UPDATE last_number = last_number + 1
  `;

  const row = await prisma.referenceSequence.findUniqueOrThrow({
    where: { serviceCode_year: { serviceCode, year } },
  });

  const padded = String(row.lastNumber).padStart(5, '0');
  return `${serviceCode}-${year}-${padded}`;
}

/** Maps a reference number's prefix back to its service code, or null if unrecognized. */
export function serviceCodeFromReference(referenceNumber) {
  const prefix = referenceNumber?.split('-')[0]?.toUpperCase();
  return Object.values(SERVICE_CODES).includes(prefix) ? prefix : null;
}