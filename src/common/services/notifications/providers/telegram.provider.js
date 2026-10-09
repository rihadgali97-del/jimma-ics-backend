import { env } from '../../../../config/env.js';
import { BadGatewayError, ServiceUnavailableError } from '../../../../common/errors/httpErrors.js';

export async function sendTelegram(_recipient, message) {
  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new ServiceUnavailableError('Telegram delivery requires TELEGRAM_BOT_TOKEN');
  }

  const text = [
    message.title || message.subject || 'Jimma Islamic Council',
    message.category && `Category: ${message.category}`,
    message.summary,
    message.description,
    message.date && `Date: ${message.date}`,
    message.time && `Time: ${message.time}`,
    message.location && `Location: ${message.location}`,
    message.district && `District: ${message.district}`,
    message.eventDate && `Date: ${message.eventDate}`,
    message.eventTime && `Time: ${message.eventTime}`,
    message.eventLocation && `Location: ${message.eventLocation}`,
    message.passNumber && `Pass: ${message.passNumber}`,
  ].filter(Boolean).join('\n\n').slice(0, 4000);

  const response = await globalThis.fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHANNEL_ID,
      text,
      disable_web_page_preview: true,
    }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok) {
    const description = result?.description || 'unknown provider error';
    if (
      response.status === 403 &&
      /bot is not a member of the channel chat|not enough rights to .*messages/i.test(description)
    ) {
      throw new BadGatewayError(
        `Telegram cannot post to ${env.TELEGRAM_CHANNEL_ID}. Add the bot as a channel administrator and grant permission to post messages.`
      );
    }
    throw new BadGatewayError(`Telegram sendMessage failed (${response.status}): ${description}`);
  }

  return { messageId: String(result.result?.message_id ?? '') };
}
