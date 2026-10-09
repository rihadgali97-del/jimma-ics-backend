import * as teachersService from './teachers.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { sendCreated, sendNoContent, sendSuccess } from '../../common/utils/apiResponse.js';

export const listPublic = asyncHandler(async (req, res) => {
  const { items, meta } = await teachersService.listTeachers(req.query, { publicOnly: true });
  sendSuccess(res, { data: items, meta });
});

export const getPublic = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await teachersService.getTeacher(req.params.id, { publicOnly: true }) });
});

export const listAdmin = asyncHandler(async (req, res) => {
  const { items, meta } = await teachersService.listTeachers(req.query, { publicOnly: false });
  sendSuccess(res, { data: items, meta });
});

export const getAdmin = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await teachersService.getTeacher(req.params.id, { publicOnly: false }) });
});

export const create = asyncHandler(async (req, res) => {
  sendCreated(res, await teachersService.createTeacher(req.body, req.user.id, req.ip));
});

export const update = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await teachersService.updateTeacher(req.params.id, req.body, req.user.id, req.ip) });
});

export const remove = asyncHandler(async (req, res) => {
  await teachersService.deleteTeacher(req.params.id, req.user.id, req.ip);
  sendNoContent(res);
});
