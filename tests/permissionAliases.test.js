import { expandPermissionAliases } from '../src/common/utils/permissionAliases.js';

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
});
