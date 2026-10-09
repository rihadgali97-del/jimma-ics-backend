// All intentional, expected errors thrown by services/controllers should be
// an AppError (or subclass). Anything else that reaches the error handler is
// treated as an unexpected 500 and logged with full detail server-side only.
export class AppError extends Error {
  constructor(message, { statusCode = 500, code = 'INTERNAL_ERROR', details = null } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}