import * as officialInquiriesService from './official-inquiries.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { sendCreated, sendSuccess } from '../../common/utils/apiResponse.js';

export const submit = asyncHandler(async (req, res) => {
  const inquiry = await officialInquiriesService.submitOfficialInquiry(req.body);
  sendCreated(res, inquiry);
});

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await officialInquiriesService.listOfficialInquiries(req.query);
  sendSuccess(res, { data: items, meta });
});

export const updateStatus = asyncHandler(async (req, res) => {
  const inquiry = await officialInquiriesService.updateOfficialInquiryStatus(
    req.params.id,
    req.body.status,
    req.user.id
  );
  sendSuccess(res, { data: inquiry });
});
