import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma, disconnectDatabase } from '../src/config/database.js';

const databaseUrl = new URL(process.env.DATABASE_URL);
const databaseName = databaseUrl.pathname.replace(/^\//, '');
if (process.env.NODE_ENV === 'production' || !['localhost', '127.0.0.1'].includes(databaseUrl.hostname) || databaseName !== 'jimma_ics') {
  throw new Error('Refusing Waqf round-trip: expected the local jimma_ics development database.');
}

let asset;
const entityType = 'waqf_asset';

try {
  const woreda = await prisma.woreda.findFirst();
  if (!woreda) throw new Error('No seeded woreda exists for the temporary Waqf asset.');

  asset = await prisma.waqfAsset.create({
    data: {
      woredaId: woreda.id,
      type: 'LAND',
      status: 'ACTIVE',
      locationNote: '__WAQF_DATABASE_ROUNDTRIP__',
      monthlyIncome: 9876,
      tenantName: 'Temporary private tenant',
      tenantContact: 'Temporary private contact',
      isPublished: true,
    },
  });
  await prisma.translation.createMany({ data: [
    { entityType, entityId: asset.id, field: 'name', locale: 'en', value: '__WAQF_DATABASE_ROUNDTRIP__' },
    { entityType, entityId: asset.id, field: 'description', locale: 'en', value: 'Temporary public Waqf summary.' },
  ] });

  const app = createApp();
  const publicResponse = await request(app).get('/api/v1/transparency/waqf?page=1&pageSize=100&locale=en');
  const publicAsset = publicResponse.body.data?.find((row) => row.id === asset.id);
  if (publicResponse.status !== 200 || !publicAsset) throw new Error('Published Waqf asset was missing from the public endpoint.');
  if ('tenantName' in publicAsset || 'tenantContact' in publicAsset || 'monthlyIncome' in publicAsset) {
    throw new Error('Private tenant or income fields leaked into the public Waqf response.');
  }

  const adminResponse = await request(app).get('/api/v1/admin/waqf');
  if (adminResponse.status !== 401) throw new Error('Admin Waqf endpoint did not require authentication.');
  console.log('Waqf database/API round-trip passed (published summary and private-field protection).');
} finally {
  if (asset) {
    await prisma.translation.deleteMany({ where: { entityType, entityId: asset.id } });
    await prisma.waqfAsset.delete({ where: { id: asset.id } });
  }
  await disconnectDatabase();
}
