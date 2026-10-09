import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import { env } from '../../../../config/env.js';

export async function sendEmail(recipient, message) {
  if (!env.GMAIL_SMTP_USER || !env.GMAIL_APP_PASSWORD) {
    throw new Error('Gmail delivery requires GMAIL_SMTP_USER and GMAIL_APP_PASSWORD');
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: env.GMAIL_SMTP_USER,
      pass: env.GMAIL_APP_PASSWORD.replace(/\s/g, ''),
    },
  });

  try {
    const isEventRegistration = message.notificationType === 'EVENT_REGISTRATION' && message.passNumber;
    const attachments = isEventRegistration
      ? [{
          filename: `Event-Pass-${message.passNumber.replace(/[^A-Za-z0-9_-]/g, '_')}.png`,
          content: await QRCode.toBuffer(message.passNumber, {
            type: 'png',
            errorCorrectionLevel: 'H',
            margin: 4,
            width: 512,
          }),
          contentType: 'image/png',
          cid: 'event-pass-qr',
          contentDisposition: 'inline',
        }]
      : undefined;

    return await transporter.sendMail({
      from: env.EMAIL_FROM_ADDRESS || env.GMAIL_SMTP_USER,
      to: recipient,
      subject: message.subject || message.title || 'Jimma Islamic Council notification',
      html: message.html || (isEventRegistration ? eventRegistrationHtml(message) : notificationHtml(message)),
      text: message.text || notificationText(message),
      ...(attachments ? { attachments } : {}),
    });
  } finally {
    transporter.close();
  }
}

function notificationText(message) {
  return [
    message.title,
    message.name && `Hello ${message.name},`,
    message.summary,
    message.description,
    message.content,
    message.eventTitle && `Event: ${message.eventTitle}`,
    message.date && `Date: ${message.date}`,
    message.time && `Time: ${message.time}`,
    message.location && `Location: ${message.location}`,
    message.eventDate && `Date: ${message.eventDate}`,
    message.eventTime && `Time: ${message.eventTime}`,
    message.eventLocation && `Location: ${message.eventLocation}`,
    message.passNumber && `Pass number: ${message.passNumber}`,
    message.attendeesCount && `Seats reserved: ${message.attendeesCount}`,
    message.notificationType === 'EVENT_REGISTRATION' && 'Your downloadable QR pass is attached as a PNG image.',
    message.verificationUrl && `Verify your email: ${message.verificationUrl}`,
  ].filter(Boolean).join('\n\n');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function notificationHtml(message) {
  const text = notificationText(message);
  const content = text.split('\n').map((line) => `<p>${escapeHtml(line)}</p>`).join('');
  return `<div style="font-family:Arial,sans-serif;line-height:1.5">${content}</div>`;
}

function eventRegistrationHtml(message) {
  const details = [
    ['Event', message.eventTitle],
    ['Date', message.eventDate],
    ['Time', message.eventTime],
    ['Location', message.eventLocation],
    ['Pass number', message.passNumber],
    ['Seats reserved', message.attendeesCount],
  ].filter(([, value]) => value !== undefined && value !== null && value !== '');
  const rows = details.map(([label, value]) => (
    `<tr><td style="padding:8px 12px;color:#57534e">${escapeHtml(label)}</td><td style="padding:8px 12px;font-weight:bold">${escapeHtml(value)}</td></tr>`
  )).join('');

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#292524;max-width:600px;margin:auto">
      <h2 style="color:#065f46">Your event registration is confirmed</h2>
      <p>Assalamu Alaykum ${escapeHtml(message.name || 'Guest')},</p>
      <p>Your place is reserved. Present this QR pass at the event entrance. The PNG pass is attached so you can download it to your phone or print it.</p>
      <table style="border-collapse:collapse;margin:20px 0;width:100%">${rows}</table>
      <div style="text-align:center;margin:24px 0">
        <img src="cid:event-pass-qr" alt="Scannable event pass ${escapeHtml(message.passNumber)}" width="256" height="256" style="width:256px;height:256px">
        <p style="font-size:12px;color:#57534e">Your pass QR is also attached as a downloadable PNG.</p>
      </div>
      <p style="font-size:12px;color:#78716c">Jimma Islamic Council</p>
    </div>
  `;
}
