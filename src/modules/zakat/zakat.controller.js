import * as zakatService from './zakat.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { sendSuccess, sendCreated, sendNoContent } from '../../common/utils/apiResponse.js';

// --- Public ---

export const submit = asyncHandler(async (req, res) => {
  const application = await zakatService.submitZakatApplication(req.body);
  sendCreated(res, application);
});

export const track = asyncHandler(async (req, res) => {
  const application = await zakatService.trackZakatApplication(
    req.params.reference,
    req.query.phone
  );
  sendSuccess(res, { data: application });
});

export const currentRate = asyncHandler(async (req, res) => {
  const rate = await zakatService.getCurrentNisabRate();
  sendSuccess(res, { data: rate });
});

// --- Admin ---

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await zakatService.listZakatApplications(req.query);
  sendSuccess(res, { data: items, meta });
});

export const getById = asyncHandler(async (req, res) => {
  const application = await zakatService.getZakatApplication(req.params.id);
  sendSuccess(res, { data: application });
});

export const updateStatus = asyncHandler(async (req, res) => {
  const application = await zakatService.updateZakatStatus(req.params.id, req.body, req.user.id);
  sendSuccess(res, { data: application });
});

export const assignOfficer = asyncHandler(async (req, res) => {
  const application = await zakatService.assignZakatOfficer(
    req.params.id,
    req.body.assignedOfficerId,
    req.user.id
  );
  sendSuccess(res, { data: application });
});

export const setRate = asyncHandler(async (req, res) => {
  const rate = await zakatService.setNisabRate(req.body, req.user.id);
  sendCreated(res, rate);
});

export const listAssessments = asyncHandler(async (req, res) => {
  const items = await zakatService.listAssessments(req.user.id);
  sendSuccess(res, { data: items });
});

export const saveAssessment = asyncHandler(async (req, res) => {
  const item = await zakatService.saveAssessment(req.user.id, req.body);
  sendCreated(res, item);
});

export const deleteAssessment = asyncHandler(async (req, res) => {
  await zakatService.deleteAssessment(req.user.id, req.params.id);
  sendNoContent(res);
});

export const listDistributions = asyncHandler(async (_req, res) => {
  const items = await zakatService.listZakatDistributions();
  sendSuccess(res, { data: items });
});

export const createDistribution = asyncHandler(async (req, res) => {
  const item = await zakatService.createZakatDistribution(req.body, req.user.id);
  sendCreated(res, item);
});
