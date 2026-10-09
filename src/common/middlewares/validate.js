import { ValidationError } from '../errors/httpErrors.js';

// Usage in a *.validation.js file:
//   export const createMosqueSchema = z.object({ body: z.object({...}), query: z.object({...}) });
// Usage in *.routes.js:
//   router.post('/', validate(createMosqueSchema), controller.create)
//
// Every request body/query/params passes through here before reaching a
// controller — never trust client input directly.
export function validate(schema) {
  return function validateMiddleware(req, res, next) {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      }));
      return next(new ValidationError('Request validation failed', details));
    }

    // Replace with parsed/coerced values (e.g. numeric query params).
    if (result.data.body) req.body = result.data.body;
    if (result.data.query) req.query = result.data.query;
    if (result.data.params) req.params = result.data.params;

    return next();
  };
}