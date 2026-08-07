export const EVENTS = [
  '100 metres',
  '200 metres',
  '400 metres',
  '800 metres',
  '1500 metres',
  '5000 metres',
  '10,000 metres',
  'Half marathon',
  'Marathon',
] as const;

export const GENDERS = ['women', 'men'] as const;
export const TIME_PARTS = ['hours', 'minutes', 'seconds', 'hundredths'] as const;

export type EventName = (typeof EVENTS)[number];
export type Gender = (typeof GENDERS)[number];
export type TimePart = (typeof TIME_PARTS)[number];

export interface NationalRecord {
  country: string;
  milliseconds: number;
  sourceUrl: string;
}

export interface RecordsData {
  generatedAt: string;
  sourcePageCount: number;
  events: Record<EventName, Record<Gender, NationalRecord[]>>;
}

export interface TimePartDefinition {
  name: TimePart;
  label: string;
  max: number;
}

const TRACK_FIELDS: TimePart[] = ['minutes', 'seconds', 'hundredths'];
const ROAD_FIELDS: TimePart[] = ['hours', 'minutes', 'seconds'];

const EVENT_FIELDS: Record<EventName, TimePart[]> = {
  '100 metres': ['seconds', 'hundredths'],
  '200 metres': ['seconds', 'hundredths'],
  '400 metres': TRACK_FIELDS,
  '800 metres': TRACK_FIELDS,
  '1500 metres': TRACK_FIELDS,
  '5000 metres': TRACK_FIELDS,
  '10,000 metres': TRACK_FIELDS,
  'Half marathon': ROAD_FIELDS,
  Marathon: ROAD_FIELDS,
};

const FIELD_DEFINITIONS: Record<TimePart, TimePartDefinition> = {
  hours: { name: 'hours', label: 'Hours', max: 9 },
  minutes: { name: 'minutes', label: 'Minutes', max: 59 },
  seconds: { name: 'seconds', label: 'Seconds', max: 59 },
  hundredths: { name: 'hundredths', label: 'Hundredths', max: 99 },
};

export function getTimeFields(event: EventName): TimePartDefinition[] {
  return EVENT_FIELDS[event].map((part) => FIELD_DEFINITIONS[part]);
}

export function getTimeFieldsForRecords(
  event: EventName,
  records: NationalRecord[],
): TimePartDefinition[] {
  const fields = getTimeFields(event).map((field) => ({ ...field }));
  if (records.length === 0) return fields;

  const slowestRecord = records.reduce(
    (slowest, record) => Math.max(slowest, record.milliseconds),
    0,
  );
  const leadingField = fields[0];
  if (!leadingField) return fields;

  const leadingUnit =
    leadingField.name === 'hours' ? 3_600_000 : leadingField.name === 'minutes' ? 60_000 : 1_000;
  leadingField.max = Math.floor(slowestRecord / leadingUnit) + 1;
  return fields;
}

export function isEventName(value: string): value is EventName {
  return EVENTS.some((event) => event === value);
}

export function isGender(value: string): value is Gender {
  return GENDERS.some((gender) => gender === value);
}

export function timePartsToMilliseconds(
  event: EventName,
  values: Partial<Record<TimePart, number>>,
): number {
  const visibleFields = getTimeFields(event);

  for (const field of visibleFields) {
    const value = values[field.name] ?? 0;
    if (!Number.isInteger(value) || value < 0 || value > field.max) {
      throw new RangeError(`${field.label} must be between 0 and ${field.max}.`);
    }
  }

  const milliseconds =
    (values.hours ?? 0) * 3_600_000 +
    (values.minutes ?? 0) * 60_000 +
    (values.seconds ?? 0) * 1_000 +
    (values.hundredths ?? 0) * 10;

  if (milliseconds <= 0) throw new RangeError('Enter a time greater than zero.');
  return milliseconds;
}

export function findSlowerRecords(
  records: NationalRecord[],
  userTimeMilliseconds: number,
): NationalRecord[] {
  return records
    .filter((record) => record.milliseconds > userTimeMilliseconds)
    .slice()
    .sort((left, right) => left.milliseconds - right.milliseconds);
}

export function formatTime(milliseconds: number): string {
  const totalHundredths = Math.round(milliseconds / 10);
  const hundredths = totalHundredths % 100;
  const totalSeconds = Math.floor(totalHundredths / 100);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}.${pad(hundredths)}`;
  }
  if (minutes > 0) return `${minutes}:${pad(seconds)}.${pad(hundredths)}`;
  return `${seconds}.${pad(hundredths)}`;
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}
