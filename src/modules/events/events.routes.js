import { Router } from 'express';
import * as eventsController from './events.controller.js';
import {
  createEventSchema,
  eventIdParamSchema,
  findMyEventRegistrationsSchema,
  listEventRegistrationsSchema,
  listEventsSchema,
  registerForEventSchema,
  reviewEventPaymentSchema,
  updateEventSchema,
  updateRegistrationSchema,
} from './events.validation.js';
import { validate } from '../../common/middlewares/validate.js';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { authorize } from '../../common/middlewares/authorize.js';
import { strictRateLimiter } from '../../common/middlewares/rateLimiter.js';
import { eventPaymentReceiptUpload } from '../../common/middlewares/upload.js';

export const eventsPublicRouter = Router();
export const eventsAdminRouter = Router();

eventsPublicRouter.get('/', validate(listEventsSchema), eventsController.listPublic);
eventsPublicRouter.get('/:id', validate(eventIdParamSchema), eventsController.getPublic);
eventsPublicRouter.post(
  '/registrations/lookup',
  strictRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 }),
  validate(findMyEventRegistrationsSchema),
  eventsController.findMyRegistrations
);
eventsPublicRouter.post(
  '/:id/registrations',
  strictRateLimiter({ windowMs: 60 * 60 * 1000, max: 12 }),
  eventPaymentReceiptUpload,
  validate(registerForEventSchema),
  eventsController.register
);

eventsAdminRouter.use(authenticate, authorize('events.write'));
eventsAdminRouter.get('/registrations', validate(listEventRegistrationsSchema), eventsController.listRegistrations);
eventsAdminRouter.get('/registrations/:id/payment-receipt', validate(reviewEventPaymentSchema.pick({ params: true })), eventsController.getPaymentReceipt);
eventsAdminRouter.patch('/registrations/:id/payment', validate(reviewEventPaymentSchema), eventsController.reviewPayment);
eventsAdminRouter.patch('/registrations/:id', validate(updateRegistrationSchema), eventsController.updateRegistration);
eventsAdminRouter.get('/', validate(listEventsSchema), eventsController.listAdmin);
eventsAdminRouter.post('/', validate(createEventSchema), eventsController.create);
eventsAdminRouter.get('/:id', validate(eventIdParamSchema), eventsController.getAdmin);
eventsAdminRouter.patch('/:id', validate(updateEventSchema), eventsController.update);
eventsAdminRouter.delete('/:id', validate(eventIdParamSchema), eventsController.remove);
