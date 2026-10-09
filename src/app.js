import express from 'express';
import path from 'node:path';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { randomUUID } from 'crypto';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';

import { env } from './config/env.js';
import { logger } from './common/utils/logger.js';
import { swaggerSpec } from './config/swagger.js';
import { defaultRateLimiter } from './common/middlewares/rateLimiter.js';
import { notFoundHandler } from './common/middlewares/notFoundHandler.js';
import { errorHandler } from './common/middlewares/errorHandler.js';
import { auditRequestContext } from './common/utils/auditRequestContext.js';
import { apiRouter } from './routes/index.js';
import { authenticate } from './common/middlewares/authenticate.js';
import { authorize } from './common/middlewares/authorize.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(compression());
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Correlation ID on every request — carried into logs and included in
  // error responses so a user-reported issue can be traced to exact log lines.
  app.use((req, res, next) => {
    req.id = req.headers['x-request-id'] || randomUUID();
    res.setHeader('x-request-id', req.id);
    next();
  });

  app.use(auditRequestContext);

  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.id,
      autoLogging: { ignore: (req) => req.url === `${env.API_PREFIX}/health` },
    })
  );

  app.use(defaultRateLimiter);

  // Keep payment proofs under the uploads volume but serve them only to event administrators.
  app.use(
    `/${env.UPLOAD_DIR}/private-event-payment-receipts`,
    authenticate,
    authorize('events.write'),
    express.static(path.resolve(env.UPLOAD_DIR, 'private-event-payment-receipts'))
  );

  // Serve uploaded files (mosque/madrasa photos, etc.) statically. In
  // production this would typically move to a CDN/object storage — see
  // the storage abstraction note in the requirements doc.
  app.use(`/${env.UPLOAD_DIR}`, express.static(env.UPLOAD_DIR));

  // Swagger UI — served outside the versioned prefix so docs URL stays
  // stable across API version bumps.
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/docs.json', (req, res) => res.json(swaggerSpec));

  app.use(env.API_PREFIX, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}