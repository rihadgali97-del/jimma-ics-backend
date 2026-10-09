// Wraps an async controller so rejected promises reach the centralized error
// handler instead of crashing the process or hanging the request.
export function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}