import * as leadershipService from './leadership.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { sendSuccess, sendCreated, sendNoContent } from '../../common/utils/apiResponse.js';

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await leadershipService.listLeadership(req.query, { publicOnly: true });
  sendSuccess(res, { data: items, meta });
});

export const getById = asyncHandler(async (req, res) => {
  const profile = await leadershipService.getLeadershipProfile(req.params.id, req.query.locale, {
    publicOnly: true,
  });
  sendSuccess(res, { data: profile });
});

// --- Admin ---

export const adminList = asyncHandler(async (req, res) => {
  const { items, meta } = await leadershipService.listLeadership(req.query, {
    publicOnly: false,
  });
  sendSuccess(res, { data: items, meta });
});

export const adminGetById = asyncHandler(async (req, res) => {
  const profile = await leadershipService.getLeadershipProfile(req.params.id, req.query.locale, {
    publicOnly: false,
  });
  sendSuccess(res, { data: profile });
});

export const create = asyncHandler(async (req, res) => {
  const profile = await leadershipService.createLeadershipProfile(req.body, req.user.id);
  sendCreated(res, profile);
});

export const update = asyncHandler(async (req, res) => {
  const profile = await leadershipService.updateLeadershipProfile(
    req.params.id,
    req.body,
    req.user.id
  );
  sendSuccess(res, { data: profile });
});

export const remove = asyncHandler(async (req, res) => {
  await leadershipService.deleteLeadershipProfile(req.params.id, req.user.id);
  sendNoContent(res);
});