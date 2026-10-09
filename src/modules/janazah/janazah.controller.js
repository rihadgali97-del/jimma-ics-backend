import * as janazahService from './janazah.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { sendSuccess, sendCreated } from '../../common/utils/apiResponse.js';

// --- Public ---

export const getAvailability = asyncHandler(async (_req, res) => {
  const availability = await janazahService.getJanazahPublicAvailability();
  sendSuccess(res, { data: availability });
});

export const submit = asyncHandler(async (req, res) => {
  const request = await janazahService.submitJanazahRequest(req.body);
  sendCreated(res, request);
});

export const track = asyncHandler(async (req, res) => {
  const request = await janazahService.trackJanazahRequest(req.params.reference, req.query.phone);
  sendSuccess(res, { data: request });
});

// --- Admin ---

export const getAdminAvailability = asyncHandler(async (_req, res) => {
  const availability = await janazahService.getJanazahPublicAvailability();
  sendSuccess(res, { data: availability });
});

export const updateAvailability = asyncHandler(async (req, res) => {
  const availability = await janazahService.setJanazahPublicAvailability(
    req.body.isEnabled,
    req.user.id
  );
  sendSuccess(res, { data: availability });
});

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await janazahService.listJanazahRequests(req.query);
  sendSuccess(res, { data: items, meta });
});

export const getById = asyncHandler(async (req, res) => {
  const request = await janazahService.getJanazahRequest(req.params.id);
  sendSuccess(res, { data: request });
});

export const updateStatus = asyncHandler(async (req, res) => {
  const request = await janazahService.updateJanazahStatus(req.params.id, req.body, req.user.id);
  sendSuccess(res, { data: request });
});

export const assignOfficer = asyncHandler(async (req, res) => {
  const request = await janazahService.assignJanazahOfficer(
    req.params.id,
    req.body.assignedOfficerId,
    req.user.id
  );
  sendSuccess(res, { data: request });
});

// --- Cemetery plots ---

export const listPlots = asyncHandler(async (req, res) => {
  const { items, meta } = await janazahService.listCemeteryPlots(req.query);
  sendSuccess(res, { data: items, meta });
});

export const createPlot = asyncHandler(async (req, res) => {
  const plot = await janazahService.createCemeteryPlot(req.body, req.user.id);
  sendCreated(res, plot);
});

export const updatePlot = asyncHandler(async (req, res) => {
  const plot = await janazahService.updateCemeteryPlot(req.params.id, req.body, req.user.id);
  sendSuccess(res, { data: plot });
});