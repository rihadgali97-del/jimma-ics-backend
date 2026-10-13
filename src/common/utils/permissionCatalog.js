import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const catalog = require('../../../../permissions/permissionCatalog.json');

export const permissionCatalog = catalog;
export const permissionDefinitions = new Map(
  catalog.categories.flatMap((category) => category.permissions.map((permission) => [permission.id, permission]))
);
export const legacyPermissionAliases = new Map(Object.entries(catalog.legacyAliases));

const recognizedPermissionKeys = new Set([
  ...permissionDefinitions.keys(),
  ...legacyPermissionAliases.keys(),
]);

export function isKnownPermissionKey(permission) {
  return recognizedPermissionKeys.has(permission);
}

export function isApiPermissionKey(permission) {
  return permissionDefinitions.has(permission);
}

export function getUnknownPermissionKeys(permissions) {
  return permissions.filter((permission) => !isKnownPermissionKey(permission));
}

export function normalizePermissionKeys(permissions) {
  const unknownPermissions = getUnknownPermissionKeys(permissions);
  if (unknownPermissions.length > 0) {
    throw new Error(`Unknown permission key(s): ${unknownPermissions.join(', ')}`);
  }
  return [...new Set(permissions.flatMap((permission) => (
    permissionDefinitions.has(permission)
      ? [permission]
      : legacyPermissionAliases.get(permission)
  )))];
}

export function normalizeKnownPermissionKeys(permissions) {
  return [...new Set(permissions
    .filter(isKnownPermissionKey)
    .flatMap((permission) => (
      permissionDefinitions.has(permission)
        ? [permission]
        : legacyPermissionAliases.get(permission)
    )))];
}

export function expandPermissionAliases(permissions = []) {
  return [...new Set([
    ...permissions,
    ...normalizeKnownPermissionKeys(permissions),
  ])];
}
