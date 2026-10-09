import { describe, expect, test } from '@jest/globals';
import { updateMadrasaSchema } from '../src/modules/madrasas/madrasas.validation.js';

describe('madrasa head teacher and Huffaz count validation', () => {
  test('accepts an existing teacher ID and a zero graduate count', () => {
    const result = updateMadrasaSchema.safeParse({
      params: { id: '12' },
      body: { headTeacherId: 5, hifzGraduatesCount: 0 },
    });

    expect(result.success).toBe(true);
  });

  test('allows clearing the head teacher and marking Huffaz count as not tracked', () => {
    const result = updateMadrasaSchema.safeParse({
      params: { id: '12' },
      body: { headTeacherId: null, hifzGraduatesCount: null },
    });

    expect(result.success).toBe(true);
  });

  test('rejects negative Huffaz counts and non-integer teacher IDs', () => {
    const result = updateMadrasaSchema.safeParse({
      params: { id: '12' },
      body: { headTeacherId: 5.5, hifzGraduatesCount: -1 },
    });

    expect(result.success).toBe(false);
  });
});
