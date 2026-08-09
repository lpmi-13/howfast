import { access, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isFreshTimestamp } from './data-freshness.ts';

const snapshotPath = resolve('src/data/results.json');
const publicSnapshotPath = resolve('static/records-data.json');
const markerPath = resolve('static/last-accessed');
const productionUrl = process.env.URL;

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readDeployedAsset(name: string): Promise<string | null> {
  if (!productionUrl) return null;

  try {
    const response = await fetch(new URL(name, `${productionUrl.replace(/\/$/u, '')}/`));
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } catch (error) {
    console.warn(`Could not check deployed ${name}: ${String(error)}`);
    return null;
  }
}

async function restoreFreshSnapshot(timestamp: string): Promise<void> {
  if (!(await fileExists(snapshotPath))) {
    const snapshot = (await fileExists(publicSnapshotPath))
      ? await readFile(publicSnapshotPath, 'utf8')
      : await readDeployedAsset('records-data.json');

    if (!snapshot) {
      throw new Error('The deployed refresh marker is fresh, but its records snapshot is missing.');
    }
    JSON.parse(snapshot);
    await writeFile(snapshotPath, snapshot, 'utf8');
    await writeFile(publicSnapshotPath, snapshot, 'utf8');
  }

  await writeFile(markerPath, `${timestamp.trim()}\n`, 'utf8');
}

const localTimestamp = (await fileExists(markerPath)) ? await readFile(markerPath, 'utf8') : null;
const deployedTimestamp = localTimestamp ?? (await readDeployedAsset('last-accessed'));

if (deployedTimestamp && isFreshTimestamp(deployedTimestamp)) {
  console.log(`Wikipedia data was refreshed within the last week (${deployedTimestamp.trim()}).`);
  console.log('Reusing the existing snapshot.');
  await restoreFreshSnapshot(deployedTimestamp);
} else {
  if (!deployedTimestamp)
    console.log('No previous last-accessed marker found; refreshing Wikipedia data.');
  else console.log('The Wikipedia data is at least one week old; refreshing it.');
  await import('./build-data.ts');
}
