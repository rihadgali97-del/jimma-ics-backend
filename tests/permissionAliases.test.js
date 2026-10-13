import { expandPermissionAliases } from '../src/common/utils/permissionAliases.js';
import {
  getUnknownPermissionKeys,
  isApiPermissionKey,
  normalizePermissionKeys,
  permissionCatalog,
} from '../src/common/utils/permissionCatalog.js';
import { authorize, authorizeAny } from '../src/common/middlewares/authorize.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

describe('expandPermissionAliases', () => {
  test('adds backend write permissions required by protected feature APIs', () => {
    expect(expandPermissionAliases(['mosque.edit', 'events.schedule'])).toEqual([
      'mosque.edit',
      'events.schedule',
      'mosques.write',
      'events.write',
    ]);
  });

  test('does not widen view-only grants', () => {
    expect(expandPermissionAliases(['mosque.view', 'finance.view'])).toEqual([
      'mosque.view',
      'finance.view',
    ]);
  });

  test('uses the catalog as the source of canonical permission keys', () => {
    const catalogKeys = permissionCatalog.categories.flatMap((category) => (
      category.permissions.map((permission) => permission.id)
    ));
    expect(new Set(catalogKeys).size).toBe(catalogKeys.length);
    expect(catalogKeys.every(isApiPermissionKey)).toBe(true);
    expect(permissionCatalog.categories.every((category) => (
      category.permissions.every((permission) => (
        Array.isArray(permission.endpoints) && permission.endpoints.length > 0
      ))
    ))).toBe(true);
    expect(Object.values(permissionCatalog.legacyAliases).flat().every(isApiPermissionKey)).toBe(true);
    expect(normalizePermissionKeys(['mosque.edit', 'events.write'])).toEqual([
      'mosques.write',
      'events.write',
    ]);
  });

  test('rejects unknown permission keys and authorization guards', () => {
    expect(getUnknownPermissionKeys(['users.manage', 'made.up.permission'])).toEqual([
      'made.up.permission',
    ]);
    expect(() => normalizePermissionKeys(['made.up.permission'])).toThrow(
      'Unknown permission key(s): made.up.permission'
    );
    expect(() => authorize('made.up.permission')).toThrow(
      'missing from the canonical permission catalog'
    );
    expect(() => authorizeAny('made.up.permission')).toThrow(
      'missing from the canonical permission catalog'
    );
  });

  test('catalogs every permission referenced by backend authorization guards', () => {
    const sourceRoot = fileURLToPath(new URL('../src/', import.meta.url));
    const sourceFiles = [];
    const visit = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) visit(entryPath);
        else if (entry.name.endsWith('.js')) sourceFiles.push(entryPath);
      }
    };
    visit(sourceRoot);

    const usedKeys = new Set();
    for (const file of sourceFiles) {
      const source = fs.readFileSync(file, 'utf8');
      for (const [, args] of source.matchAll(/authorize(?:Any)?\(([^)]*)\)/g)) {
        for (const [, key] of args.matchAll(/['"]([^'"]+)['"]/g)) usedKeys.add(key);
      }
    }

    expect([...usedKeys].filter((key) => !isApiPermissionKey(key))).toEqual([]);
  });
});
