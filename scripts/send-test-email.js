import '../src/config/env.js';
import { sendEmail } from '../src/common/services/notifications/providers/email.provider.js';

const args = process.argv.slice(2);
const recipient = args[0]?.trim();
if (args.length !== 1 || !recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
  console.error('Usage: npm run test:email -- <recipient-email>');
  process.exitCode = 1;
} else {
  try {
    const result = await sendEmail(recipient, {
      subject: 'Jimma ICS notification email test',
      title: 'Gmail SMTP is connected',
      summary: 'This is a test message confirming Gmail SMTP integration for Jimma Islamic Council notifications. No action is required.',
    });
    console.info(`Gmail accepted the test email for ${recipient}. Message ID: ${result.messageId}`);
  } catch (error) {
    console.error(`Test email failed: ${error instanceof Error ? error.message : 'Unknown mail delivery error'}`);
    process.exitCode = 1;
  }
}
