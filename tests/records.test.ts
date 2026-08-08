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

  it('caps the leading wheel just beyond double the slowest category record', () => {
    const record = (milliseconds: number) => ({
      country: 'Testland',
      milliseconds,
      sourceUrl: 'https://example.test/record',
    });

    expect(getTimeFieldsForRecords('100 metres', [record(14_410)])[0]?.max).toBe(29);
    expect(getTimeFieldsForRecords('800 metres', [record(125_050)])[0]?.max).toBe(5);
    expect(getTimeFieldsForRecords('1500 metres', [record(259_650)])[0]?.max).toBe(9);
    expect(getTimeFieldsForRecords('Marathon', [record(11_302_000)])[0]?.max).toBe(7);
  });

  it('adds larger time fields instead of overflowing minutes or seconds', () => {
    const record = (milliseconds: number) => ({
      country: 'Testland',
      milliseconds,
      sourceUrl: 'https://example.test/record',
    });
    const sprintFields = getTimeFieldsForRecords('200 metres', [record(30_870)]);
    const trackFields = getTimeFieldsForRecords('10,000 metres', [record(2_909_000)]);
    const roadFields = getTimeFieldsForRecords('Marathon', [record(18_581_000)]);

    expect(sprintFields.map(({ name, max }) => ({ name, max }))).toEqual([
      { name: 'minutes', max: 2 },
      { name: 'seconds', max: 59 },
      { name: 'hundredths', max: 99 },
    ]);
    expect(trackFields.map(({ name, max }) => ({ name, max }))).toEqual([
      { name: 'hours', max: 2 },
      { name: 'minutes', max: 59 },
      { name: 'seconds', max: 59 },
      { name: 'hundredths', max: 99 },
    ]);
    expect(timePartsToMilliseconds('200 metres', { minutes: 1, seconds: 2 }, sprintFields)).toBe(
      62_000,
    );
    expect(timePartsToMilliseconds('10,000 metres', { hours: 1, minutes: 37 }, trackFields)).toBe(
      5_820_000,
    );
    expect(timePartsToMilliseconds('Marathon', { hours: 11 }, roadFields)).toBe(39_600_000);
    expect(() => timePartsToMilliseconds('10,000 metres', { minutes: 97 }, trackFields)).toThrow(
      'Minutes must be between 0 and 59.',
    );
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
