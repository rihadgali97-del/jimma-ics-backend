// Minimal env so config/env.js validation passes when running tests without
// a real .env file (CI, fresh clone). No real secrets/credentials here.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'mysql://jimma_ics:test@localhost:3306/jimma_ics_test';
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-please-override-in-real-env-0000000000';
process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-please-override-in-real-env-000000000';
process.env.REDIS_URL ??= 'redis://localhost:6379';