// Every successful response in the API follows this shape:
//   { success: true, data: <payload>, meta?: {...} }
// Every error response (built by the error handler) follows:
//   { success: false, error: { code, message, details? } }
// Controllers should never build error responses directly — they throw an
// AppError (see common/errors) and let the centralized handler format it.

export function sendSuccess(res, { data = null, meta = null, statusCode = 200 } = {}) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

export function sendCreated(res, data) {
  return sendSuccess(res, { data, statusCode: 201 });
}

export function sendNoContent(res) {
  return res.status(204).send();
}