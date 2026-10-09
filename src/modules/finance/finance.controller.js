import * as financeService from './finance.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { sendSuccess, sendCreated, sendNoContent } from '../../common/utils/apiResponse.js';

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await financeService.listFinancialReports(req.query, {
    publicOnly: true,
  });
  sendSuccess(res, { data: items, meta });
});

export const getById = asyncHandler(async (req, res) => {
  const report = await financeService.getFinancialReport(req.params.id, req.query.locale, {
    publicOnly: true,
  });
  sendSuccess(res, { data: report });
});

// --- Admin ---

export const adminList = asyncHandler(async (req, res) => {
  const { items, meta } = await financeService.listFinancialReports(req.query, {
    publicOnly: false,
  });
  sendSuccess(res, { data: items, meta });
});

export const adminGetById = asyncHandler(async (req, res) => {
  const report = await financeService.getFinancialReport(req.params.id, req.query.locale, {
    publicOnly: false,
  });
  sendSuccess(res, { data: report });
});

export const create = asyncHandler(async (req, res) => {
  const report = await financeService.createFinancialReport(req.body, req.user.id);
  sendCreated(res, report);
});

export const update = asyncHandler(async (req, res) => {
  const report = await financeService.updateFinancialReport(req.params.id, req.body, req.user.id);
  sendSuccess(res, { data: report });
});

export const remove = asyncHandler(async (req, res) => {
  await financeService.deleteFinancialReport(req.params.id, req.user.id);
  sendNoContent(res);
});