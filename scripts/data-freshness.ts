export const DATA_MAX_AGE_MILLISECONDS = 7 * 24 * 60 * 60 * 1_000;

export function isFreshTimestamp(
  value: string,
  now = new Date(),
  maxAgeMilliseconds = DATA_MAX_AGE_MILLISECONDS,
): boolean {
  const timestamp = Date.parse(value.trim());
  if (!Number.isFinite(timestamp)) return false;

  const age = now.getTime() - timestamp;
  return age >= 0 && age < maxAgeMilliseconds;
}
