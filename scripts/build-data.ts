import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { type BuildProgress, buildRecordsData, parseSourcesFile } from './wikipedia-records.ts';

const sourcePath = resolve('urls.txt');
const outputPath = resolve('src/data/results.json');

async function main(): Promise<void> {
  console.log(`Reading Wikipedia page list from ${sourcePath}`);
  const sources = parseSourcesFile(await readFile(sourcePath, 'utf8'));
  console.log(`Found ${sources.length} Wikipedia pages to refresh.`);

  const data = await buildRecordsData(sources, fetch, logProgress);

  console.log(`Finished processing ${data.sourcePageCount} Wikipedia pages.`);
  console.log(`Writing generated records to ${outputPath}`);
  await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${outputPath}`);
}

function logProgress(progress: BuildProgress): void {
  if (progress.stage === 'retrying') {
    console.warn(
      `Retrying ${progress.source.country} (attempt ${progress.attempt}/${progress.maxAttempts}) ` +
        `in ${formatDelay(progress.delayMilliseconds)}: ${progress.reason}`,
    );
    return;
  }

  const prefix = `[${progress.pageNumber}/${progress.totalPages}]`;
  if (progress.stage === 'fetching') {
    const url = new URL(progress.source.url, 'https://en.wikipedia.org');
    console.log(`${prefix} Fetching ${progress.source.country}: ${url.href}`);
  } else {
    console.log(
      `${prefix} Processed ${progress.source.country}: found ${progress.recordCount} supported records.`,
    );
  }
}

function formatDelay(milliseconds: number): string {
  return milliseconds < 1_000 ? `${milliseconds}ms` : `${milliseconds / 1_000}s`;
}

await main();
