import { sendTelegram } from './providers/telegram.provider.js';
import { sendEmail } from './providers/email.provider.js';
import { sendPush } from './providers/push.provider.js';
import { BadRequestError } from '../../errors/httpErrors.js';

const PROVIDERS = {
  TELEGRAM: sendTelegram,
  EMAIL: sendEmail,
  WEB_PUSH: sendPush,
};

/**
 * Single entry point the notification worker calls — looks up the right
 * provider for `channel` and delegates to it. Adding a 5th channel later
 * means adding one provider file plus one line here, not touching the
 * worker itself.
 */
export async function dispatch(channel, recipient, message, pushSubscription) {
  const send = PROVIDERS[channel];
  if (!send) {
    throw new BadRequestError(`No notification provider registered for channel "${channel}"`);
  }
  if (channel === 'WEB_PUSH') return send(pushSubscription, message);
  if (channel === 'TELEGRAM') return send(recipient, message);
  return send(recipient, message);
}