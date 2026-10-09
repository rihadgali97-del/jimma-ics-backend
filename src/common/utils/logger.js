import pino from 'pino';
import { Writable } from 'node:stream';
import { env } from '../../config/env.js';

const levels = { 10: 'TRACE', 20: 'DEBUG', 30: 'INFO', 40: 'WARN', 50: 'ERROR', 60: 'FATAL' };

function formatDevelopmentLog(event) {
  const timestamp = new Date(event.time || Date.now()).toLocaleTimeString('en-GB', { hour12: false });
  const level = levels[event.level] || 'INFO';
  const request = event.req && event.res
    ? `${event.req.method} ${event.req.url} -> ${event.res.statusCode} (${Math.round(event.responseTime || 0)} ms)`
    : '';
  const requestId = event.req?.id || event.requestId;
  const error = event.err?.message ? ` | ${event.err.type || 'Error'}: ${event.err.message}` : '';
  const stack = event.level >= 50 && event.err?.stack
    ? `\n${event.err.stack.split('\n').slice(1).map((line) => `    ${line.trim()}`).join('\n')}`
    : '';
  const message = event.msg || event.err?.message || 'Log event';
  const details = Object.entries(event)
    .filter(([key]) => !['time', 'level', 'pid', 'hostname', 'msg', 'req', 'res', 'responseTime', 'err', 'requestId'].includes(key))
    .map(([key, value]) => `${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join(' ');

  return `${timestamp} ${level.padEnd(5)} ${request || message}${error}${requestId ? ` | requestId=${requestId}` : ''}${details ? ` | ${details}` : ''}${stack}\n`;
}

const developmentDestination = new Writable({
  write(chunk, _encoding, callback) {
    try {
      const event = JSON.parse(chunk.toString());
      process.stdout.write(formatDevelopmentLog(event));
      callback();
    } catch (error) {
      callback(error);
    }
  },
});

// Human readable locally; retain structured JSON in test and production.
export const logger = pino(
  { level: env.LOG_LEVEL },
  env.NODE_ENV === 'development' ? developmentDestination : undefined
);
