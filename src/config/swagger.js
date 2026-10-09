import swaggerJSDoc from 'swagger-jsdoc';
import { env } from './env.js';

const swaggerDefinition = {
  openapi: '3.0.3',
  info: {
    title: 'Jimma ICS API',
    version: '0.1.0',
    description:
      'Backend API for the Jimma Zone Islamic Affairs Supreme Council digital platform.',
  },
  servers: [{ url: env.API_PREFIX, description: 'Current environment' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      ApiSuccess: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: { type: 'object' },
          meta: { type: 'object', nullable: true },
        },
      },
      ApiError: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string' },
              details: { type: 'array', items: { type: 'object' }, nullable: true },
            },
          },
        },
      },
    },
  },
};

// Every module's *.routes.js file carries JSDoc @openapi blocks; swagger-jsdoc
// scans them here. Feature modules just need to add their glob path once created.
export const swaggerSpec = swaggerJSDoc({
  definition: swaggerDefinition,
  apis: ['./src/modules/**/*.routes.js', './src/docs/**/*.yaml'],
});