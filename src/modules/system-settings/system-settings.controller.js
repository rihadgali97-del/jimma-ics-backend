import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { sendSuccess } from '../../common/utils/apiResponse.js';
import { getSystemSettingsStatus } from './system-settings.service.js';

export const getStatus = asyncHandler(async (_req, res) => {
  sendSuccess(res, { data: await getSystemSettingsStatus() });
});
