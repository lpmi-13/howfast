import { access } from 'node:fs/promises';
import { resolve } from 'node:path';

const outputPath = resolve('src/data/results.json');

try {
  await access(outputPath);
} catch {
  process.stdout.write('No local records snapshot found; fetching one now.\n');
  await import('./build-data.ts');
}
