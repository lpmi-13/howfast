import { describe, expect, it } from 'vitest';
import {
  findSlowerRecords,
  formatTime,
  getTimeFields,
  getTimeFieldsForRecords,
  timePartsToMilliseconds,
  type NationalRecord,
} from '../src/domain/records';

describe('time entry', () => {
  it('shows only meaningful fields for each event', () => {
    expect(getTimeFields('100 metres').map((field) => field.name)).toEqual([
      'seconds',
      'hundredths',
    ]);
    expect(getTimeFields('Marathon').map((field) => field.name)).toEqual([
      'hours',
      'minutes',
      'seconds',
    ]);
  });

  it('converts hundredths to real milliseconds', () => {
    expect(timePartsToMilliseconds('100 metres', { seconds: 19, hundredths: 42 })).toBe(19_420);
    expect(timePartsToMilliseconds('Marathon', { hours: 3, minutes: 2, seconds: 1 })).toBe(
      10_921_000,
    );
  });

  it('rejects zero and out-of-range times', () => {
    expect(() => timePartsToMilliseconds('100 metres', { seconds: 0 })).toThrow(
      'greater than zero',
    );
    expect(() => timePartsToMilliseconds('100 metres', { seconds: 60 })).toThrow(
      'between 0 and 59',
    );
  });

  it('caps the leading wheel just beyond the slowest category record', () => {
    const record = (milliseconds: number) => ({
      country: 'Testland',
      milliseconds,
      sourceUrl: 'https://example.test/record',
    });

    expect(getTimeFieldsForRecords('100 metres', [record(14_410)])[0]?.max).toBe(15);
    expect(getTimeFieldsForRecords('800 metres', [record(125_050)])[0]?.max).toBe(3);
    expect(getTimeFieldsForRecords('Marathon', [record(11_302_000)])[0]?.max).toBe(4);
  });
});

describe('record comparison', () => {
  const records: NationalRecord[] = [
    { country: 'Fastland', milliseconds: 10_000, sourceUrl: 'https://example.test/fast' },
    { country: 'Slowland', milliseconds: 12_000, sourceUrl: 'https://example.test/slow' },
    { country: 'Middleland', milliseconds: 11_000, sourceUrl: 'https://example.test/middle' },
  ];

  it('returns only slower records, ordered from the closest comparison', () => {
    expect(findSlowerRecords(records, 10_500).map((record) => record.country)).toEqual([
      'Middleland',
      'Slowland',
    ]);
  });

  it('formats sprint, middle-distance, and road times', () => {
    expect(formatTime(9_830)).toBe('9.83');
    expect(formatTime(97_280)).toBe('1:37.28');
    expect(formatTime(7_329_000)).toBe('2:02:09.00');
  });
});
