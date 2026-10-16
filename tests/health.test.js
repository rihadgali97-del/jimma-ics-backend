import request from 'supertest';
import { createApp } from '../src/app.js';

describe('GET /api/v1/health', () => {
  it('returns 200 and a success envelope', async () => {
    const app = createApp();
    const res = await request(app)
      .get('/api/v1/health')
      .set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });
});

describe('GET /api/v1/unknown-route', () => {
  it('returns a consistent 404 error envelope', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/unknown-route');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});

describe('GET /uploads/:file', () => {
  it('allows public uploaded assets to load cross-origin', async () => {
    const app = createApp();
    const res = await request(app).get('/uploads/cross-origin-header-test.jpg');

    expect(res.status).toBe(404);
    expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
  });
});