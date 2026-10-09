import * as civicServicesService from './civic-services.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { sendSuccess } from '../../common/utils/apiResponse.js';

export const listAvailability = asyncHandler(async (_req, res) => {
  const availability = await civicServicesService.listCivicServiceAvailability();
  sendSuccess(res, { data: availability });
});

export const updateAvailability = asyncHandler(async (req, res) => {
  const availability = await civicServicesService.setCivicServiceAvailability(
    req.params.serviceKey,
    req.body.isEnabled,
    req.user.id
  );
  sendSuccess(res, { data: availability });
});
