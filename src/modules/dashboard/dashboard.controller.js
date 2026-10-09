import * as dashboardService from './dashboard.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { sendSuccess } from '../../common/utils/apiResponse.js';

export const getSummary = asyncHandler(async (req, res) => {
  const summary = await dashboardService.getDashboardSummary({ forceRefresh: req.query.refresh });
  sendSuccess(res, { data: summary });
});