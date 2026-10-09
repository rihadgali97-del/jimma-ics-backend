import argon2 from 'argon2';
import { prisma } from '../config/database.js';
import { logger } from '../common/utils/logger.js';

// Roles from the requirements doc (§1). Permission keys are namespaced
// `<domain>.<action>` so future modules just add new keys — no schema change.
const ROLES = [
  { name: 'super_admin', description: 'Full system access' },
  { name: 'secretariat_admin', description: 'Announcements, events, content, leadership directory' },
  { name: 'case_officer', description: 'Handles Zakat/Janazah applications' },
  { name: 'finance_officer', description: 'Financial reports, Zakat disbursements, Waqf registry' },
  { name: 'content_editor', description: 'Mosques/madrasas directory, fatwa archive, translations' },
  { name: 'dispatcher', description: 'Telegram/SMS broadcast center, event reminders' },
  { name: 'pending_staff', description: 'New staff account awaiting role assignment; no permissions' },
];

const PERMISSIONS = [
  'users.manage',
  'roles.manage',
  'woredas.write',
  'mosques.write',
  'madrasas.write',
  'documents.write',
  'zakat.manage',
  'zakat.rates.write',
  'janazah.manage',
  'cemetery_plots.write',
  'waqf.write',
  'finance.write',
  'announcements.write',
  'announcements.broadcast',
  'events.write',
  'broadcast.send',
  'fatwas.write',
  'leadership.write',
  'dashboard.view',
  'translations.write',
];

// 18 Woredas mentioned in the frontend README. Names/translations are
// added via the `translations` table once the woredas module exists.
const WOREDA_CODES = [
  'jimma-town', 'agaro', 'kersa', 'limmu-kosa', 'mana', 'seka-chekorsa',
  'gomma', 'dedo', 'omo-nada', 'tiro-afeta', 'sokoru', 'setema',
  'gera', 'shebe-sombo', 'nono-benja', 'limmu-seka', 'kaffa-donsa', 'buno-bedele',
];

async function seedRoles() {
  const roleRecords = {};
  for (const role of ROLES) {
    roleRecords[role.name] = await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: role,
    });
  }
  return roleRecords;
}

async function seedPermissions() {
  const permissionRecords = {};
  for (const key of PERMISSIONS) {
    permissionRecords[key] = await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key },
    });
  }
  return permissionRecords;
}

async function seedRolePermissions(roleRecords, permissionRecords) {
  const grants = {
    super_admin: PERMISSIONS,
    secretariat_admin: [
      'announcements.write', 'announcements.broadcast', 'events.write',
      'documents.write', 'leadership.write', 'dashboard.view', 'translations.write',
    ],
    case_officer: ['zakat.manage', 'janazah.manage', 'cemetery_plots.write', 'dashboard.view'],
    finance_officer: ['finance.write', 'waqf.write', 'zakat.rates.write', 'dashboard.view'],
    content_editor: [
      'mosques.write', 'madrasas.write', 'documents.write', 'fatwas.write',
      'leadership.write', 'translations.write', 'dashboard.view',
    ],
    dispatcher: ['broadcast.send', 'announcements.broadcast', 'events.write', 'dashboard.view'],
    pending_staff: [],
  };

  for (const [roleName, permissionKeys] of Object.entries(grants)) {
    const role = roleRecords[roleName];
    if (role.metadata?.permissionsCustomized === true) continue;
    for (const permissionKey of permissionKeys) {
      const permission = permissionRecords[permissionKey];
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }
}

async function seedWoredas() {
  for (const [index, code] of WOREDA_CODES.entries()) {
    const woreda = await prisma.woreda.upsert({
      where: { code },
      update: {},
      create: { code },
    });
    await prisma.translation.upsert({
      where: {
        entityType_entityId_field_locale: {
          entityType: 'woreda',
          entityId: woreda.id,
          field: 'name',
          locale: 'en',
        },
      },
      update: {},
      create: {
        entityType: 'woreda',
        entityId: woreda.id,
        field: 'name',
        locale: 'en',
        value: `Kebele ${String(index + 1).padStart(2, '0')}`,
      },
    });
  }
}

async function seedSuperAdmin(roleRecords) {
  const email = process.env.SEED_SUPER_ADMIN_EMAIL || 'admin@jimmaislamiccouncil.org';
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD;

  if (!password) {
    logger.warn(
      'SEED_SUPER_ADMIN_PASSWORD not set — skipping super admin seed. Set it in .env to create the first login.'
    );
    return;
  }

  const passwordHash = await argon2.hash(password);

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      fullName: 'System Administrator',
      email,
      passwordHash,
      roleId: roleRecords.super_admin.id,
      isActive: true,
    },
  });

  logger.info(`Seeded super_admin account: ${email}`);
}

async function main() {
  logger.info('Seeding database...');
  const roleRecords = await seedRoles();
  const permissionRecords = await seedPermissions();
  await seedRolePermissions(roleRecords, permissionRecords);
  await seedWoredas();
  await seedSuperAdmin(roleRecords);
  logger.info('Seed complete.');
}

main()
  .catch((err) => {
    logger.error({ err }, 'Seed failed');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
