import * as usersService from './users.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { sendSuccess, sendCreated } from '../../common/utils/apiResponse.js';

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await usersService.listUsers(req.query);
  sendSuccess(res, { data: items, meta });
});

export const getById = asyncHandler(async (req, res) => {
  const user = await usersService.getUser(req.params.id);
  sendSuccess(res, { data: user });
});

export const create = asyncHandler(async (req, res) => {
  const user = await usersService.createUser(req.body, req.user.id);
  sendCreated(res, user);
});

export const update = asyncHandler(async (req, res) => {
  const user = await usersService.updateUser(req.params.id, req.body, req.user.id);
  sendSuccess(res, { data: user });
});

export const deactivate = asyncHandler(async (req, res) => {
  const user = await usersService.deactivateUser(req.params.id, req.user.id);
  sendSuccess(res, { data: user });
});

export const uploadPhoto = asyncHandler(async (req, res) => {
  const result = await usersService.uploadStaffPhoto(req.params.id, req.file, req.user.id);
  sendSuccess(res, { data: result });
});