import { load } from 'cheerio';
import {
  EVENTS,
  GENDERS,
  type EventName,
  type Gender,
  type NationalRecord,
  type RecordsData,
} from '../src/domain/records.ts';

export interface WikipediaSource {
  country: string;
  url: string;
}

type Fetcher = typeof fetch;

export type BuildProgress =
  | {
      stage: 'fetching';
      source: WikipediaSource;
      pageNumber: number;
      totalPages: number;
    }
  | {
      stage: 'retrying';
      source: WikipediaSource;
      attempt: number;
      maxAttempts: number;
      delayMilliseconds: number;
      reason: string;
    }
  | {
      stage: 'processed';
      source: WikipediaSource;
      pageNumber: number;
      totalPages: number;
      recordCount: number;
    };

type ProgressReporter = (progress: BuildProgress) => void;

const WIKIPEDIA_ORIGIN = 'https://en.wikipedia.org';
const EVENT_TITLES = new Map<string, EventName>(EVENTS.map((event) => [event, event]));
const REQUEST_TIMEOUT_MS = 25_000;
const MAX_CONCURRENCY = 1;
const MIN_REQUEST_INTERVAL_MS = 2_000;
const MAX_FETCH_ATTEMPTS = 5;
const RETRY_DELAY_BASE_MS = 5_000;
const MAX_RETRY_DELAY_MS = 60_000;

export function parseSourcesFile(contents: string): WikipediaSource[] {
  const seen = new Set<string>();
  const sources: WikipediaSource[] = [];

  for (const [index, line] of contents.split(/\r?\n/u).entries()) {
    if (!line.trim()) continue;

    let candidate: unknown;
    try {
      candidate = JSON.parse(line);
    } catch {
      throw new Error(`Invalid JSON on source line ${index + 1}.`);
    }

    if (!isWikipediaSource(candidate)) {
      throw new Error(`Invalid country or URL on source line ${index + 1}.`);
    }

    const key = `${candidate.country}\u0000${candidate.url}`;
    if (!seen.has(key)) {
      seen.add(key);
      sources.push(candidate);
    }
  }

  return sources;
}

export function parseRecordTime(rawValue: string, event?: EventName): number | null {
  const match = rawValue.replaceAll(',', '').match(/\b\d{1,2}(?::\d{1,2}){0,2}(?:\.\d{1,3})?\b/u);
  if (!match) return null;

  let normalizedTime = match[0];
  if (
    (event === 'Half marathon' || event === 'Marathon') &&
    /^\d:\d{2}\.\d{2}$/u.test(normalizedTime)
  ) {
    normalizedTime = normalizedTime.replace('.', ':');
  }

  const parts = normalizedTime.split(':');
  const lastPart = parts.pop();
  if (!lastPart) return null;

  const [wholeSecondsText, fractionText = ''] = lastPart.split('.');
  const wholeSeconds = Number.parseInt(wholeSecondsText ?? '', 10);
  const fractionMilliseconds = Number.parseInt(fractionText.padEnd(3, '0').slice(0, 3) || '0', 10);
  if (!Number.isFinite(wholeSeconds) || (wholeSeconds > 59 && parts.length > 0)) return null;

  const leading = parts.map((part) => Number.parseInt(part, 10));
  if (leading.some((part) => !Number.isFinite(part))) return null;

  let hours = 0;
  let minutes = 0;
  if (leading.length === 1) {
    minutes = leading[0] ?? 0;
  } else if (leading.length === 2) {
    hours = leading[0] ?? 0;
    minutes = leading[1] ?? 0;
  } else if (leading.length > 2) {
    return null;
  }

  return hours * 3_600_000 + minutes * 60_000 + wholeSeconds * 1_000 + fractionMilliseconds;
}

export function parseWikipediaRecords(
  html: string,
  source: WikipediaSource,
): Partial<Record<Gender, Partial<Record<EventName, NationalRecord>>>> {
  const $ = load(html);
  const parsed: Partial<Record<Gender, Partial<Record<EventName, NationalRecord>>>> = {};
  let inOutdoorSection = false;
  let outdoorSectionId = 'Outdoor';
  let gender: Gender | null = null;

  $('h2, h3, h4, h5, tr').each((_index, element) => {
    const tagName = element.tagName.toLowerCase();

    if (tagName === 'h2') {
      inOutdoorSection = /^outdoor\b/iu.test($(element).text().trim());
      if (inOutdoorSection) {
        outdoorSectionId =
          $(element).attr('id') ?? $(element).find('[id]').first().attr('id') ?? 'Outdoor';
      }
      gender = null;
      return;
    }

    if (tagName === 'h3' || tagName === 'h4' || tagName === 'h5') {
      if (!inOutdoorSection) return;
      const heading = $(element).text().trim().toLowerCase();
      const headingGender = /^(?:women|women's)(?: records)?$/u.test(heading)
        ? 'women'
        : /^(?:men|men's)(?: records)?$/u.test(heading)
          ? 'men'
          : null;
      const isNonSeniorSection =
        /\b(?:junior|masters|mixed|u ?(?:18|20|23)|under[- ]?(?:18|20|23)|youth)\b/iu.test(heading);
      if (tagName === 'h3' || headingGender || isNonSeniorSection) gender = headingGender;
      return;
    }

    if (!inOutdoorSection || !gender) return;
    const cells = $(element).children('td');
    if (cells.length < 2) return;

    const firstCell = cells.first();
    const eventTitle = firstCell
      .find('a[title]')
      .toArray()
      .map((anchor) => $(anchor).attr('title'))
      .find((title): title is string => Boolean(title && EVENT_TITLES.has(title)));
    if (!eventTitle) return;

    const event = EVENT_TITLES.get(eventTitle);
    if (!event) return;

    const recordCell = cells.eq(1).clone();
    recordCell.find('small, sup, style').remove();
    const milliseconds = parseRecordTime(recordCell.text(), event);
    if (milliseconds === null) return;

    const sourceUrl = new URL(source.url, WIKIPEDIA_ORIGIN);
    sourceUrl.hash = outdoorSectionId;
    const record: NationalRecord = {
      country: source.country,
      milliseconds,
      sourceUrl: sourceUrl.href,
    };
    const current = parsed[gender]?.[event];

    if (!current || record.milliseconds < current.milliseconds) {
      const genderRecords = parsed[gender] ?? {};
      genderRecords[event] = record;
      parsed[gender] = genderRecords;
    }
  });

  return parsed;
}

export async function buildRecordsData(
  sources: WikipediaSource[],
  fetcher: Fetcher = fetch,
  onProgress: ProgressReporter = () => {},
): Promise<RecordsData> {
  const events = createEmptyEvents();
  let completed = 0;
  const waitForRequestSlot = createRequestPacer(MIN_REQUEST_INTERVAL_MS);

  await mapWithConcurrency(sources, MAX_CONCURRENCY, async (source) => {
    const pageNumber = completed + 1;
    onProgress({ stage: 'fetching', source, pageNumber, totalPages: sources.length });

    try {
      const html = await fetchWikipediaPage(source, fetcher, waitForRequestSlot, onProgress);
      const parsed = parseWikipediaRecords(html, source);
      let recordCount = 0;

      for (const gender of GENDERS) {
        for (const event of EVENTS) {
          const record = parsed[gender]?.[event];
          if (record) {
            events[event][gender].push(record);
            recordCount += 1;
          }
        }
      }

      onProgress({
        stage: 'processed',
        source,
        pageNumber,
        totalPages: sources.length,
        recordCount,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load records for ${source.country}: ${reason}`, { cause: error });
    } finally {
      completed += 1;
    }
  });

  for (const event of EVENTS) {
    for (const gender of GENDERS) {
      events[event][gender].sort((left, right) => left.milliseconds - right.milliseconds);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    sourcePageCount: sources.length,
    events,
  };
}

export async function fetchWikipediaPage(
  source: WikipediaSource,
  fetcher: Fetcher,
  waitForRequestSlot: () => Promise<void> = () => Promise.resolve(),
  onProgress: ProgressReporter = () => {},
): Promise<string> {
  const url = new URL(source.url, WIKIPEDIA_ORIGIN);
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt += 1) {
    await waitForRequestSlot();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetcher(url, {
        headers: {
          Accept: 'text/html',
          'User-Agent': 'HowFastAmI/1.0 (https://howfastami.netlify.app; static data build)',
        },
        redirect: 'follow',
        signal: controller.signal,
      });
      if (!response.ok) {
        const error = new Error(`Wikipedia returned HTTP ${response.status}`);
        if (!isRetryableStatus(response.status)) throw new NonRetryableFetchError(error.message);
        if (attempt === MAX_FETCH_ATTEMPTS) throw error;

        lastError = error;
        const delayMilliseconds = getRetryDelay(response.headers.get('retry-after'), attempt);
        reportRetry(onProgress, source, attempt, delayMilliseconds, error);
        await wait(delayMilliseconds);
        continue;
      }
      return await response.text();
    } catch (error) {
      if (error instanceof NonRetryableFetchError) throw error;
      lastError = error;
      if (attempt < MAX_FETCH_ATTEMPTS) {
        const delayMilliseconds = getRetryDelay(null, attempt);
        reportRetry(onProgress, source, attempt, delayMilliseconds, error);
        await wait(delayMilliseconds);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Wikipedia request failed.');
}

class NonRetryableFetchError extends Error {}

function reportRetry(
  onProgress: ProgressReporter,
  source: WikipediaSource,
  attempt: number,
  delayMilliseconds: number,
  error: unknown,
): void {
  onProgress({
    stage: 'retrying',
    source,
    attempt: attempt + 1,
    maxAttempts: MAX_FETCH_ATTEMPTS,
    delayMilliseconds,
    reason: error instanceof Error ? error.message : String(error),
  });
}

function createRequestPacer(intervalMilliseconds: number): () => Promise<void> {
  let queue = Promise.resolve();
  let lastRequestAt = 0;

  return () => {
    const slot = queue.then(async () => {
      const delay = Math.max(0, lastRequestAt + intervalMilliseconds - Date.now());
      if (delay > 0) await wait(delay);
      lastRequestAt = Date.now();
    });
    queue = slot.catch(() => {});
    return slot;
  };
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function getRetryDelay(retryAfter: string | null, attempt: number): number {
  if (retryAfter !== null) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1_000, MAX_RETRY_DELAY_MS);
    }

    const retryAt = Date.parse(retryAfter);
    if (Number.isFinite(retryAt)) {
      return Math.min(Math.max(0, retryAt - Date.now()), MAX_RETRY_DELAY_MS);
    }
  }

  return Math.min(RETRY_DELAY_BASE_MS * 2 ** (attempt - 1), MAX_RETRY_DELAY_MS);
}

function createEmptyEvents(): RecordsData['events'] {
  return Object.fromEntries(
    EVENTS.map((event) => [event, { women: [], men: [] }]),
  ) as unknown as RecordsData['events'];
}

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      const item = items[index];
      if (item) await worker(item);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runWorker));
}

function isWikipediaSource(value: unknown): value is WikipediaSource {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.country === 'string' &&
    candidate.country.trim().length > 0 &&
    typeof candidate.url === 'string' &&
    candidate.url.startsWith('/wiki/')
  );
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
