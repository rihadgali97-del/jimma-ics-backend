import { jest } from '@jest/globals';
import request from 'supertest';
import argon2 from 'argon2';

// Prisma is mocked at the module boundary so these tests exercise real
// routing/validation/service/controller logic without needing a live MySQL
// instance. Full integration tests against a real test database (per
// README) are the next layer of coverage once Phase 3+ modules exist.
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  passwordResetToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  role: {
    findUnique: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
};

jest.unstable_mockModule('../src/config/database.js', () => ({
  prisma: mockPrisma,
  connectDatabase: jest.fn(),
  disconnectDatabase: jest.fn(),
}));

// app.js -> routes -> auth/users modules all resolve to the mock above once
// imported dynamically *after* jest.unstable_mockModule is registered.
const { createApp } = await import('../src/app.js');

const TEST_USER = {
  id: 1,
  fullName: 'Test Admin',
  email: 'admin@example.com',
  phone: null,
  passwordHash: '',
  isActive: true,
  roleId: 1,
  lastLoginAt: null,
  role: { id: 1, name: 'super_admin' },
};

beforeAll(async () => {
  TEST_USER.passwordHash = await argon2.hash('correct-password-123');
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/v1/auth/login', () => {
  it('rejects a request with no body', async () => {
    const app = createApp();
    const res = await request(app).post('/api/v1/auth/login').send({});
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 for an unknown email without revealing that fact', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const app = createApp();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever123' });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  it('returns 401 for a wrong password', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(TEST_USER);

    const app = createApp();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_USER.email, password: 'totally-wrong-password' });

    expect(res.status).toBe(401);
  });

  it('returns tokens + user profile for valid credentials', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(TEST_USER);
    mockPrisma.user.update.mockResolvedValue(TEST_USER);
    mockPrisma.refreshToken.create.mockResolvedValue({ id: 1 });
    mockPrisma.auditLog.create.mockResolvedValue({ id: 1 });

    const app = createApp();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_USER.email, password: 'correct-password-123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.data.user.email).toBe(TEST_USER.email);
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('rejects an inactive account', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...TEST_USER, isActive: false });

    const app = createApp();
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: TEST_USER.email, password: 'correct-password-123' });

    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/auth/me', () => {
  it('returns 401 with no Authorization header', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 401 for a malformed Authorization header', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', 'not-a-bearer-token');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/auth/register', () => {
  const registration = {
    fullName: 'New Staff',
    email: 'new.staff@example.com',
    phone: '+251911223344',
    password: 'correct-password-123',
  };

  beforeEach(() => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.role.findUnique.mockResolvedValue({ id: 2, name: 'pending_staff' });
  });

  it('reports when the phone number is already in use', async () => {
    mockPrisma.user.create.mockRejectedValue({
      code: 'P2002',
      meta: { target: 'users_phone_key' },
    });

    const app = createApp();
    const res = await request(app).post('/api/v1/auth/register').send(registration);

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('An account with this phone number already exists');
  });

  it('continues to report when the email is already in use', async () => {
    mockPrisma.user.create.mockRejectedValue({
      code: 'P2002',
      meta: { target: ['email'] },
    });

    const app = createApp();
    const res = await request(app).post('/api/v1/auth/register').send(registration);

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('An account with this email already exists');
  });
});

describe('POST /api/v1/auth/forgot-password', () => {
  it('always returns a generic success message', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const app = createApp();
    const res = await request(app)
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'anyone@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.data.message).toMatch(/reset link/i);
  });
});

describe('GET /api/v1/admin/users', () => {
  it('requires authentication', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/admin/users');
    expect(res.status).toBe(401);
  });
});