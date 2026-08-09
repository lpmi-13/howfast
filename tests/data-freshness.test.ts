import { describe, expect, it } from 'vitest';
import { DATA_MAX_AGE_MILLISECONDS, isFreshTimestamp } from '../scripts/data-freshness.ts';

describe('Wikipedia data freshness', () => {
  const now = new Date('2026-08-09T12:00:00.000Z');

  it('accepts UTC timestamps less than one week old', () => {
    expect(isFreshTimestamp('2026-08-03T12:00:00.001Z\n', now)).toBe(true);
  });

  it('refreshes at exactly one week and for invalid timestamps', () => {
    expect(
      isFreshTimestamp(new Date(now.getTime() - DATA_MAX_AGE_MILLISECONDS).toISOString(), now),
    ).toBe(false);
    expect(isFreshTimestamp('not-a-timestamp', now)).toBe(false);
  });

  it('rejects timestamps in the future', () => {
    expect(isFreshTimestamp('2026-08-09T12:00:00.001Z', now)).toBe(false);
  });
});
