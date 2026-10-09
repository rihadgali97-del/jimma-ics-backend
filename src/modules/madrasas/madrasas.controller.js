import * as madrasasService from './madrasas.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { sendSuccess, sendCreated, sendNoContent } from '../../common/utils/apiResponse.js';
import { uploadDirectoryPhoto } from '../../common/services/directoryPhoto.service.js';

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await madrasasService.listMadrasas(req.query, { publicOnly: true });
  sendSuccess(res, { data: items, meta });
});

export const getById = asyncHandler(async (req, res) => {
  const madrasa = await madrasasService.getMadrasa(req.params.id, req.query.locale, {
    publicOnly: true,
  });
  sendSuccess(res, { data: madrasa });
});

// --- Admin ---

export const adminList = asyncHandler(async (req, res) => {
  const { items, meta } = await madrasasService.listMadrasas(req.query, { publicOnly: false });
  sendSuccess(res, { data: items, meta });
});

export const adminGetById = asyncHandler(async (req, res) => {
  const madrasa = await madrasasService.getMadrasa(req.params.id, req.query.locale, {
    publicOnly: false,
  });
  sendSuccess(res, { data: madrasa });
});

export const create = asyncHandler(async (req, res) => {
  const madrasa = await madrasasService.createMadrasa(req.body, req.user.id);
  sendCreated(res, madrasa);
});

export const update = asyncHandler(async (req, res) => {
  const madrasa = await madrasasService.updateMadrasa(req.params.id, req.body, req.user.id);
  sendSuccess(res, { data: madrasa });
});

export const uploadPhoto = asyncHandler(async (req, res) => {
  const photo = await uploadDirectoryPhoto('madrasa', req.params.id, req.file, req.user.id);
  sendSuccess(res, { data: photo });
});

export const remove = asyncHandler(async (req, res) => {
  await madrasasService.deleteMadrasa(req.params.id, req.user.id);
  sendNoContent(res);
});