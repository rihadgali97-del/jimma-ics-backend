import * as trackerService from './tracker.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { sendSuccess } from '../../common/utils/apiResponse.js';

export const track = asyncHandler(async (req, res) => {
  const result = await trackerService.trackByReference(req.params.reference, req.query.phone);
  sendSuccess(res, { data: result });
});