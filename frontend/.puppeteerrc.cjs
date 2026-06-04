// Puppeteer config. `screenshot.mjs` (see DESIGN.md) is a LOCAL-only dev tool, so
// don't download the ~Chromium bundle on every `npm ci` — that's what was failing
// CI and would also bloat the Vercel build. The puppeteer npm package still installs
// (its JS is tiny); only the browser binary is skipped.
//
// To use the screenshot loop locally, fetch a browser once:
//   npx puppeteer browsers install chrome
module.exports = {
  skipDownload: true,
};
