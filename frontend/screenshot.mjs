// Screenshot a running localhost URL so Claude (or you) can eyeball the UI.
//
// Usage:
//   node screenshot.mjs [url] [label]
// Examples:
//   node screenshot.mjs                                   # http://localhost:8081
//   node screenshot.mjs http://localhost:8081/routes routes
//
// Saves to ./screenshots/screenshot-N.png (auto-incremented, never overwritten;
// optional `-label` suffix). Read the PNG back with the Read tool to inspect it.
//
// Prereq: the Expo web dev server must already be running — `npm run web`
// (i.e. `expo start --web`) serves on http://localhost:8081. Always screenshot
// localhost, never a file:// URL (react-native-web needs the bundler).
//
// Viewport defaults to a phone (the app is mobile-first); override with
// SHOT_WIDTH / SHOT_HEIGHT env vars.

import { mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';

const url = process.argv[2] ?? 'http://localhost:8081';
const label = process.argv[3] ?? '';

const width = Number(process.env.SHOT_WIDTH ?? 390);
const height = Number(process.env.SHOT_HEIGHT ?? 844);

const dir = path.resolve('screenshots');
mkdirSync(dir, { recursive: true });

const next =
  readdirSync(dir)
    .map((f) => Number(f.match(/^screenshot-(\d+)/)?.[1]))
    .filter((n) => Number.isFinite(n))
    .reduce((max, n) => Math.max(max, n), 0) + 1;

const name = `screenshot-${next}${label ? `-${label}` : ''}.png`;
const outPath = path.join(dir, name);

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 2 });

  // networkidle2 + a short settle so the RN bundle mounts and first paint lands.
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 });
  await new Promise((r) => setTimeout(r, 1500));

  await page.screenshot({ path: outPath, fullPage: true });
  console.log(`Saved ${path.relative(process.cwd(), outPath)}`);
} finally {
  await browser.close();
}
