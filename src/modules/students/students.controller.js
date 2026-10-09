import * as studentsService from './students.service.js';
import { asyncHandler } from '../../common/utils/asyncHandler.js';
import { sendCreated, sendSuccess } from '../../common/utils/apiResponse.js';

export const list = asyncHandler(async (req, res) => {
  const { items, meta } = await studentsService.listStudents(req.query);
  sendSuccess(res, { data: items, meta });
});

export const create = asyncHandler(async (req, res) => {
  sendCreated(res, await studentsService.createStudent(req.body, req.user.id, req.ip));
});

export const update = asyncHandler(async (req, res) => {
  sendSuccess(res, {
    data: await studentsService.updateStudent(req.params.id, req.body, req.user.id, req.ip),
  });
});
