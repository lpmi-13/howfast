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

const WIKIPEDIA_ORIGIN = 'https://en.wikipedia.org';
const EVENT_TITLES = new Map<string, EventName>(EVENTS.map((event) => [event, event]));
const REQUEST_TIMEOUT_MS = 25_000;
const MAX_CONCURRENCY = 6;

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
  let gender: Gender | null = null;

  $('h2, h3, h4, h5, tr').each((_index, element) => {
    const tagName = element.tagName.toLowerCase();

    if (tagName === 'h2') {
      inOutdoorSection = /^outdoor\b/iu.test($(element).text().trim());
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

    const record: NationalRecord = {
      country: source.country,
      milliseconds,
      sourceUrl: new URL(source.url, WIKIPEDIA_ORIGIN).href,
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
  onProgress: (completed: number, total: number) => void = () => {},
): Promise<RecordsData> {
  const events = createEmptyEvents();
  let completed = 0;

  await mapWithConcurrency(sources, MAX_CONCURRENCY, async (source) => {
    try {
      const html = await fetchWikipediaPage(source, fetcher);
      const parsed = parseWikipediaRecords(html, source);

      for (const gender of GENDERS) {
        for (const event of EVENTS) {
          const record = parsed[gender]?.[event];
          if (record) events[event][gender].push(record);
        }
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`Skipped ${source.country}: ${reason}`);
    } finally {
      completed += 1;
      onProgress(completed, sources.length);
    }
  });

  for (const event of EVENTS) {
    for (const gender of GENDERS) {
      events[event][gender].sort((left, right) => left.milliseconds - right.milliseconds);
    }
  }

  validateCoverage(events);

  return {
    generatedAt: new Date().toISOString(),
    sourcePageCount: sources.length,
    events,
  };
}

async function fetchWikipediaPage(source: WikipediaSource, fetcher: Fetcher): Promise<string> {
  const url = new URL(source.url, WIKIPEDIA_ORIGIN);
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
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
      if (!response.ok) throw new Error(`Wikipedia returned HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < 3) await wait(attempt * 300);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Wikipedia request failed.');
}

function createEmptyEvents(): RecordsData['events'] {
  return Object.fromEntries(
    EVENTS.map((event) => [event, { women: [], men: [] }]),
  ) as unknown as RecordsData['events'];
}

function validateCoverage(events: RecordsData['events']): void {
  const missing = EVENTS.flatMap((event) =>
    GENDERS.filter((gender) => events[event][gender].length < 20).map(
      (gender) => `${event} (${gender}): ${events[event][gender].length}`,
    ),
  );

  if (missing.length > 0) {
    throw new Error(`Wikipedia parsing produced too few records:\n${missing.join('\n')}`);
  }
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
