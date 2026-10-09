import { Router } from 'express';
import * as authController from './auth.controller.js';
import {
  loginSchema,
  registerSchema,
  refreshSchema,
  logoutSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.validation.js';
import { validate } from '../../common/middlewares/validate.js';
import { authenticate } from '../../common/middlewares/authenticate.js';
import { strictRateLimiter } from '../../common/middlewares/rateLimiter.js';

export const authRouter = Router();

const loginLimiter = strictRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });
const registerLimiter = strictRateLimiter({ windowMs: 60 * 60 * 1000, max: 5 });
const forgotPasswordLimiter = strictRateLimiter({ windowMs: 60 * 60 * 1000, max: 5 });

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Staff login (email + password)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Access + refresh token pair and the user profile
 *       401:
 *         description: Invalid credentials
 */
authRouter.post('/login', loginLimiter, validate(loginSchema), authController.login);

/** Public registration creates an active account with the no-permission pending_staff role. */
authRouter.post('/register', registerLimiter, validate(registerSchema), authController.register);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     summary: Rotate a refresh token for a new access/refresh pair
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: New access + refresh token pair
 *       401:
 *         description: Refresh token invalid, expired, or revoked
 */
authRouter.post('/refresh', validate(refreshSchema), authController.refresh);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Revoke a refresh token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: Token revoked (idempotent)
 */
authRouter.post('/logout', validate(logoutSchema), authController.logout);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Current authenticated user's profile
 *     tags: [Auth]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: The authenticated user
 *       401:
 *         description: Missing/invalid access token
 */
authRouter.get('/me', authenticate, authController.me);

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     summary: Request a password reset token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: Always returns a generic success message, regardless of whether the email exists
 */
authRouter.post(
  '/forgot-password',
  forgotPasswordLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword
);

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     summary: Reset password using a token from forgot-password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword]
 *             properties:
 *               token: { type: string }
 *               newPassword: { type: string, minLength: 10 }
 *     responses:
 *       200:
 *         description: Password updated; all refresh tokens for the account are revoked
 *       401:
 *         description: Token invalid or expired
 */
authRouter.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);
