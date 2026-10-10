import nodemailer from 'nodemailer';
import { randomBytes } from 'node:crypto';
import QRCode from 'qrcode';
import { env } from '../../../../config/env.js';

function getSmtpTransport() {
  if (!env.GMAIL_SMTP_USER || !env.GMAIL_APP_PASSWORD) {
    throw new Error('Gmail delivery requires GMAIL_SMTP_USER and GMAIL_APP_PASSWORD');
  }

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: env.GMAIL_SMTP_USER,
      pass: env.GMAIL_APP_PASSWORD.replace(/\s/g, ''),
    },
  });
}

function getOAuth2Config() {
  const user = env.GMAIL_OAUTH2_USER || env.GMAIL_SMTP_USER;
  if (!user || !env.GMAIL_CLIENT_ID || !env.GMAIL_CLIENT_SECRET || !env.GMAIL_REFRESH_TOKEN) {
    throw new Error('Gmail API delivery requires GMAIL_OAUTH2_USER (or GMAIL_SMTP_USER), GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN');
  }

  return { user, clientId: env.GMAIL_CLIENT_ID, clientSecret: env.GMAIL_CLIENT_SECRET, refreshToken: env.GMAIL_REFRESH_TOKEN };
}

function hasOAuthConfiguration() {
  return Boolean(
    env.GMAIL_CLIENT_ID ||
    env.GMAIL_CLIENT_SECRET ||
    env.GMAIL_REFRESH_TOKEN ||
    env.GMAIL_OAUTH2_USER
  );
}

async function getGmailAccessToken(config) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) {
    throw new Error(`Google OAuth token exchange failed (HTTP ${response.status}): ${data.error_description || data.error || 'No access token returned'}`);
  }
  return data.access_token;
}

function encodeBase64Lines(value) {
  return Buffer.from(value).toString('base64').match(/.{1,76}/g)?.join('\r\n') || '';
}

function encodeSubject(value) {
  const subject = String(value).replace(/[\r\n]+/g, ' ');
  return `=?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`;
}

function safeHeader(value) {
  return String(value).replace(/[\r\n]+/g, ' ').trim();
}

function buildRawEmail({ from, to, subject, text, html, attachments = [] }) {
  const mixedBoundary = `mixed_${randomBytes(16).toString('hex')}`;
  const alternativeBoundary = `alternative_${randomBytes(16).toString('hex')}`;
  const headers = [
    `From: ${safeHeader(from)}`,
    `To: ${safeHeader(to)}`,
    `Subject: ${encodeSubject(subject)}`,
    'MIME-Version: 1.0',
  ];
  const parts = [];

  if (attachments.length) {
    headers.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);
    parts.push(`--${mixedBoundary}`);
  } else {
    headers.push(`Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`);
  }

  if (attachments.length) {
    parts.push(`Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`, '');
  }
  parts.push(
    `--${alternativeBoundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    encodeBase64Lines(text),
    `--${alternativeBoundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    encodeBase64Lines(html),
    `--${alternativeBoundary}--`
  );

  for (const attachment of attachments) {
    const filename = safeHeader(attachment.filename).replace(/[";]/g, '_');
    parts.push(
      `--${mixedBoundary}`,
      `Content-Type: ${safeHeader(attachment.contentType)}; name="${filename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: ${safeHeader(attachment.contentDisposition || 'attachment')}; filename="${filename}"`,
      ...(attachment.cid ? [`Content-ID: <${safeHeader(attachment.cid)}>`] : []),
      '',
      encodeBase64Lines(attachment.content)
    );
  }
  if (attachments.length) parts.push(`--${mixedBoundary}--`);

  const mimeMessage = `${headers.join('\r\n')}\r\n\r\n${parts.join('\r\n')}`;
  return Buffer.from(mimeMessage).toString('base64url');
}

async function sendViaGmailApi(recipient, message, html, text, attachments) {
  const config = getOAuth2Config();
  const accessToken = await getGmailAccessToken(config);
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      raw: buildRawEmail({
        from: env.EMAIL_FROM_ADDRESS || config.user,
        to: recipient,
        subject: message.subject || message.title || 'Jimma Islamic Council notification',
        html,
        text,
        attachments,
      }),
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.id) {
    const detail = data.error?.message || 'Gmail API did not return a message ID';
    throw new Error(`Gmail API send failed (HTTP ${response.status}): ${detail}`);
  }
  return { messageId: data.id };
}

export async function sendEmail(recipient, message) {
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
    : [];
  const html = message.html || (isEventRegistration ? eventRegistrationHtml(message) : notificationHtml(message));
  const text = message.text || notificationText(message);

  if (hasOAuthConfiguration()) {
    return sendViaGmailApi(recipient, message, html, text, attachments);
  }

  const transporter = getSmtpTransport();
  try {
    return await transporter.sendMail({
      from: env.EMAIL_FROM_ADDRESS || env.GMAIL_SMTP_USER,
      to: recipient,
      subject: message.subject || message.title || 'Jimma Islamic Council notification',
      html,
      text,
      ...(attachments.length ? { attachments } : {}),
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
        <a href="cid:event-pass-qr" download="Event-Pass-${escapeHtml(message.passNumber.replace(/[^A-Za-z0-9_-]/g, '_'))}.png" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#047857;color:#ffffff;text-decoration:none;font-weight:bold">Download QR pass</a>
      </div>
      <p style="font-size:12px;color:#78716c">Jimma Islamic Council</p>
    </div>
  `;
}
