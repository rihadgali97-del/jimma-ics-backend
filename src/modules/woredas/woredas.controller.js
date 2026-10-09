import * as woredasService from './woredas.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { sendSuccess, sendCreated } from '../../common/utils/apiResponse.js';

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await woredasService.listWoredas(req.query);
  sendSuccess(res, { data: items, meta });
});

export const listAdmin = asyncHandler(async (req, res) => {
  const { items, meta } = await woredasService.listWoredas(req.query, { includeInactive: true });
  sendSuccess(res, { data: items, meta });
});

export const listGis = asyncHandler(async (req, res) => {
  const { items, meta } = await woredasService.listWoredasGis(req.query);
  sendSuccess(res, { data: items, meta });
});

export const getById = asyncHandler(async (req, res) => {
  const woreda = await woredasService.getWoreda(req.params.id, req.query.locale);
  sendSuccess(res, { data: woreda });
});

export const create = asyncHandler(async (req, res) => {
  const woreda = await woredasService.createWoreda(req.body, req.user.id);
  sendCreated(res, woreda);
});

export const update = asyncHandler(async (req, res) => {
  const woreda = await woredasService.updateWoreda(req.params.id, req.body, req.user.id);
  sendSuccess(res, { data: woreda });
});