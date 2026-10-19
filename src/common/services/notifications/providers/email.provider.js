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
  const response = await globalThis.fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new globalThis.URLSearchParams({
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
  const response = await globalThis.fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
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
  const eventPassQrContent = isEventRegistration
    ? [
        `PASS:${String(message.passNumber).replace(/[\r\n]+/g, ' ').trim()}`,
        `NAME:${String(message.name || 'Guest').replace(/[\r\n]+/g, ' ').trim()}`,
        `SEATS:${message.attendeesCount || 1}`,
      ].join('\n')
    : null;
  const passFilename = isEventRegistration
    ? `Event-Pass-${message.passNumber.replace(/[^A-Za-z0-9_-]/g, '_')}.png`
    : null;
  const passImage = isEventRegistration
    ? await QRCode.toBuffer(eventPassQrContent, {
          type: 'png',
          errorCorrectionLevel: 'H',
          margin: 4,
          width: 512,
        })
    : null;
  const attachments = isEventRegistration
    ? [{
        filename: passFilename,
        content: passImage,
        contentType: 'image/png',
        cid: 'event-pass-qr',
        contentDisposition: 'inline',
      }, {
        filename: passFilename,
        content: passImage,
        contentType: 'image/png',
        contentDisposition: 'attachment',
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
    message.passDownloadUrl && `Download your QR pass: ${message.passDownloadUrl}`,
    message.verificationUrl && `${message.linkLabel || 'Verify your email'}: ${message.verificationUrl}`,
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

function emailLayout(title, content) {
  return `
    <div style="margin:0;padding:32px 16px;background-color:#f4f7f5;font-family:Arial,sans-serif;color:#1f2933">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;margin:0 auto;background-color:#ffffff;border:1px solid #e2e8e4;border-radius:12px;overflow:hidden">
        <tr>
          <td style="padding:22px 32px;background-color:#065f46;color:#ffffff;font-size:14px;font-weight:bold;letter-spacing:.4px">
            Jimma Islamic Council
          </td>
        </tr>
        <tr>
          <td style="padding:32px">
            <h1 style="margin:0 0 20px;color:#123b2d;font-size:24px;line-height:1.3">${escapeHtml(title)}</h1>
            ${content}
          </td>
        </tr>
        <tr>
          <td style="padding:18px 32px;background-color:#f8faf9;color:#647067;font-size:12px;line-height:1.5">
            This message was sent by Jimma Islamic Council.
          </td>
        </tr>
      </table>
    </div>
  `;
}

function notificationHtml(message) {
  const paragraphs = notificationText(message)
    .split(/\n\n/)
    .filter((paragraph) => paragraph !== message.title)
    .filter((paragraph) => !message.verificationUrl || !paragraph.includes(message.verificationUrl))
    .map((paragraph) => `<p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.7">${escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('');
  const verificationLink = message.verificationUrl
    ? `<p style="margin:24px 0 0">
        <a href="${escapeHtml(message.verificationUrl)}" style="display:inline-block;padding:13px 22px;border-radius:7px;background-color:#047857;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold">
          ${escapeHtml(message.linkLabel || 'Verify your email address')}
        </a>
      </p>`
    : '';
  return emailLayout(message.title || 'A message from Jimma Islamic Council', `${paragraphs}${verificationLink}`);
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
  const downloadButton = message.passDownloadUrl
    ? `<p style="margin:24px 0 0;text-align:center">
        <a href="${escapeHtml(message.passDownloadUrl)}" style="display:inline-block;padding:13px 22px;border-radius:7px;background-color:#047857;color:#ffffff;text-decoration:none;font-size:15px;font-weight:bold">
          Download your QR pass
        </a>
      </p>`
    : '';

  const content = `
    <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.7">Assalamu Alaykum ${escapeHtml(message.name || 'Guest')},</p>
    <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.7">Your place is reserved. Present this QR pass at the event entrance. Download it using the button below, or save the attached PNG to your phone or print it.</p>
    <table role="presentation" style="border-collapse:collapse;margin:20px 0;width:100%;background-color:#f8faf9;border:1px solid #e2e8e4">${rows}</table>
    <div style="padding:20px;text-align:center;background-color:#f8faf9;border-radius:8px">
      <img src="cid:event-pass-qr" alt="Scannable event pass ${escapeHtml(message.passNumber)}" width="256" height="256" style="display:block;width:256px;height:256px;margin:0 auto">
      <p style="margin:12px 0;color:#647067;font-size:13px">You can also save the attached PNG to your device or print it.</p>
    </div>
    ${downloadButton}
  `;

  return emailLayout('Your event registration is confirmed', content);
}
