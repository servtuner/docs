// Opens key pages in Chrome at two widths and both themes; fails on console errors, failed requests, horizontal
// page scroll, or a search with no results. Screenshots go to artifacts/browser. CHROME overrides the browser path.
import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { BASE } from './lib/site.mjs';
import { serve } from './serve.mjs';

const executablePath = [process.env.CHROME, '/usr/bin/google-chrome', '/usr/bin/chromium'].find(
  (p) => p && existsSync(p),
);
const { server, url } = await serve();
const browser = await chromium.launch({ executablePath });
mkdirSync('artifacts/browser', { recursive: true });
const pages = {
  landing: '',
  guide: 'guides/runspecs/',
  api: 'reference/api/runs/',
  diagram: 'overview/architecture/',
  tuning: 'guides/tuning-sessions/',
  experiment: 'guides/experiments/',
};
const problems = [];
let checks = 0;
for (const [size, viewport] of Object.entries({
  desktop: { width: 1440, height: 900 },
  phone: { width: 390, height: 844 },
}))
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport, colorScheme: theme });
    await context.addInitScript((t) => localStorage.setItem('starlight-theme', t), theme);
    const page = await context.newPage();
    let at = '';
    page.on(
      'console',
      (m) => ['error', 'warning'].includes(m.type()) && problems.push(`${at}: console ${m.type()}: ${m.text()}`),
    );
    page.on('pageerror', (e) => problems.push(`${at}: ${e.message}`));
    page.on('response', (r) => r.status() >= 400 && problems.push(`${at}: ${r.status()} ${r.url()}`));
    for (const [name, path] of Object.entries(pages)) {
      at = `${name} ${size} ${theme}`;
      await page.goto(url + path, { waitUntil: 'networkidle' });
      const state = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - innerWidth,
        theme: document.documentElement.dataset.theme,
        title: document.querySelector('h1')?.textContent,
      }));
      if (state.overflow > 0) problems.push(`${at}: page scrolls ${state.overflow}px horizontally`);
      if (state.theme !== theme) problems.push(`${at}: theme is ${state.theme}`);
      if (!state.title) problems.push(`${at}: no heading`);
      await page.screenshot({ path: `artifacts/browser/${name}-${size}-${theme}.png` });
      checks += 1;
    }
    at = `search ${size} ${theme}`;
    await page.locator('button[data-open-modal]').click();
    await page.locator('dialog input').fill('preset');
    await page
      .waitForSelector('.pagefind-ui__result-link', { timeout: 10000 })
      .catch(() => problems.push(`${at}: no results`));
    const found = await page.locator('.pagefind-ui__result-link').count();
    const href = found ? await page.locator('.pagefind-ui__result-link').first().getAttribute('href') : '';
    if (found && !href.startsWith(BASE)) problems.push(`${at}: result outside the base path: ${href}`);
    console.log(`${at}: ${found} results, first ${href}`);
    checks += 1;
    await context.close();
  }
// Every page, phone width, light: errors and overflow only.
const all = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
let at = '';
all.on('console', (m) => m.type() === 'error' && problems.push(`${at}: ${m.text()}`));
all.on('pageerror', (e) => problems.push(`${at}: ${e.message}`));
const sitemap = await (await fetch(`${url}sitemap-0.xml`)).text();
const paths = [...sitemap.matchAll(new RegExp(`<loc>https?://[^/<]+${BASE}([^<]*)</loc>`, 'g'))].map((m) => m[1]);
for (at of paths) {
  await all.goto(url + at);
  const over = await all.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (over > 0) problems.push(`${at}: page scrolls ${over}px horizontally at phone width`);
}
await browser.close();
server.close();
problems.forEach((p) => console.error(`PROBLEM ${p}`));
console.log(`check-browser: ${checks} detailed checks, ${paths.length} pages swept, ${problems.length} problem(s)`);
process.exit(problems.length ? 1 : 0);
