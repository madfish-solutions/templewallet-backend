import { describe, expect, it } from 'vitest';

import { isAfterCursor } from './is-after-cursor.util';

describe('isAfterCursor', () => {
  it('compares createdAt first and id on ties', () => {
    expect(isAfterCursor(2, 1, 1, 9)).toBe(true);
    expect(isAfterCursor(1, 9, 2, 0)).toBe(false);
    expect(isAfterCursor(1, 1, 1, 1)).toBe(false);
    expect(isAfterCursor(1, 2, 1, 1)).toBe(true);
  });
});
