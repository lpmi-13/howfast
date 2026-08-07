# How Fast Am I?

How Fast Am I? is a static web app that compares a runner’s time with senior outdoor national
records from around the world.

Choose an event and category, enter a time, and the app highlights every country whose senior
national record is slower. Record entries link back to their English Wikipedia source pages.

<https://howfastami.netlify.app>

## Stack

- Vanilla TypeScript and Vite
- Vitest for parser and comparison unit tests
- Playwright with axe-core for desktop, mobile, and accessibility flows
- Biome for linting and formatting
- A TypeScript Wikipedia ingestion script using Cheerio

The deployed app is entirely static. It has no Python dependencies, server process, database,
runtime API requests, credentials, or Netlify Functions. Every production build fetches a fresh
record snapshot and bundles it with the site, so entered times never leave the browser.

## Development

Use Node.js 24 and npm 11, then run:

```sh
npm ci
npm run dev
```

Useful commands:

```sh
npm run data       # refresh the local snapshot from Wikipedia
npm run lint       # static analysis
npm test           # unit tests
npm run test:e2e   # desktop/mobile Chrome and accessibility tests
npm run build      # refresh records, type-check, and create dist/
npm run build:app  # build with the existing local snapshot (offline)
npm run check      # lint, unit tests, build, and formatting
```

`npm run dev` reuses the local snapshot when one exists and automatically creates one on the first
run. Use `npm run data` whenever you want to refresh it during development. The generated
`src/data/results.json` file is ignored by Git, so it is never something you need to commit.

`npm run build` always refreshes the snapshot before building. `npm run build:app` is available when
you deliberately want an offline build using the existing local snapshot.

## Record ingestion

`urls.txt` contains one JSON record per English Wikipedia national-record page. The TypeScript data
builder:

1. fetches those pages with bounded concurrency, a descriptive user agent, timeouts, and retries;
2. reads only senior **Outdoor → Men** and **Outdoor → Women** tables;
3. explicitly ignores junior, U18/U20/U23, youth, mixed, and masters sections;
4. normalizes sprint, track, half-marathon, and marathon time formats to milliseconds;
5. keeps the fastest senior record when a table contains tied or repeated rows;
6. fails if any event/category produces implausibly sparse coverage; and
7. writes a sorted, attributed, Git-ignored static snapshot to `src/data/results.json`.

Focused fixtures test the parser independently of Wikipedia. The generated snapshot currently
covers nine events: 100 m, 200 m, 400 m, 800 m, 1500 m, 5000 m, 10,000 m, half marathon, and
marathon.

Wikipedia content is available under CC BY-SA; the UI retains source-page links and attribution.

## Netlify

`netlify.toml` configures:

- build command: `npm run build`, which fetches the latest Wikipedia data before compiling
- publish directory: `dist`
- exact Node and npm versions
- an SPA fallback to `index.html`
- a restrictive Content Security Policy and common security headers
- immutable caching for hashed Vite assets

No environment variables are required.

## Project layout

```text
scripts/        Wikipedia fetch, parse, validation, and snapshot generation
src/data/       generated records snapshot and checked-in world geometry
src/domain/     event definitions, time conversion, comparison, and formatting
src/ui/         DOM application and map rendering
tests/          Vitest unit tests
e2e/            Playwright browser and accessibility tests
static/         files copied directly into the production build
```
