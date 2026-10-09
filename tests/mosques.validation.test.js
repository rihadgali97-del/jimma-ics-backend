import { describe, expect, test } from '@jest/globals';
import { createMosqueSchema, updateMosqueSchema } from '../src/modules/mosques/mosques.validation.js';

describe('mosque madrasa linking validation', () => {
  test('accepts a registered madrasa ID when creating a mosque', () => {
    const result = createMosqueSchema.safeParse({
      body: { woredaId: 3, madrasaId: 12, name: { en: 'Central Mosque' } },
    });

    expect(result.success).toBe(true);
  });

  test('allows clearing an existing mosque-madrasa link', () => {
    const result = updateMosqueSchema.safeParse({
      params: { id: '8' },
      body: { madrasaId: null },
    });

    expect(result.success).toBe(true);
  });

  test('rejects a non-positive madrasa ID', () => {
    const result = updateMosqueSchema.safeParse({
      params: { id: '8' },
      body: { madrasaId: 0 },
    });

    expect(result.success).toBe(false);
  });
});
