import { serviceCodeFromReference, SERVICE_CODES } from '../../common/services/referenceNumber.service.js';
import { trackZakatApplication } from '../zakat/zakat.service.js';
import { trackJanazahRequest } from '../janazah/janazah.service.js';
import { BadRequestError } from '../../common/errors/httpErrors.js';

// A single public entry point ("Track my application") that figures out
// which service a reference number belongs to from its prefix (ZKT/JNZ) and
// delegates to that service's own tracker — so the frontend only needs one
// tracker page/endpoint regardless of which service the citizen used.
export async function trackByReference(reference, phone) {
  const serviceCode = serviceCodeFromReference(reference);

  if (serviceCode === SERVICE_CODES.zakat) {
    const result = await trackZakatApplication(reference, phone);
    return { service: 'zakat', ...result };
  }

  if (serviceCode === SERVICE_CODES.janazah) {
    const result = await trackJanazahRequest(reference, phone);
    return { service: 'janazah', ...result };
  }

  throw new BadRequestError('Unrecognized reference number format');
}