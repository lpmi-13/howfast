import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildRecordsData, parseSourcesFile } from './wikipedia-records.ts';

const sourcePath = resolve('urls.txt');
const outputPath = resolve('src/data/results.json');

async function main(): Promise<void> {
  const sources = parseSourcesFile(await readFile(sourcePath, 'utf8'));
  process.stdout.write(`Refreshing records from ${sources.length} Wikipedia pages`);

  const data = await buildRecordsData(sources, fetch, (completed, total) => {
    if (completed % 10 === 0 || completed === total) process.stdout.write('.');
  });

  await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  process.stdout.write(`\nWrote ${outputPath}\n`);
}

await main();
