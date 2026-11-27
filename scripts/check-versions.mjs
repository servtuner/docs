// Checks the assembled multi-version site in site/, in Chrome (CHROME overrides the browser path):
// - / is the latest release (or, before one, the no-release page) and is the only indexed version;
// - every version's picker lists every version, and choosing one keeps the reader on the same page; on a phone it
//   is in the menu, and nothing scrolls sideways;
// - every version but the latest says so in a banner that links to the latest, and the latest has none.
import { existsSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { serve } from './serve.mjs';

const { latest, versions } = JSON.parse(readFileSync('site/versions.json', 'utf8'));
const executablePath = [process.env.CHROME, '/usr/bin/google-chrome', '/usr/bin/chromium'].find(
  (p) => p && existsSync(p),
);
const { server, url } = await serve(0, 'site', '/');
const origin = new URL(url).origin;
const browser = await chromium.launch({ executablePath });
const page = await browser.newPage();
const problems = [];
const expect = (ok, message) => ok || problems.push(message);
const PAGE = 'guides/costs/';

if (!latest) {
  await page.goto(`${origin}/`);
  expect((await page.textContent('body')).includes('no stable release yet'), '/: no-release page missing');
}
for (const version of versions) {
  await page.goto(`${origin}${version.base}${PAGE}`, { waitUntil: 'networkidle' });
  const at = version.base;
  const robots = await page
    .locator('meta[name="robots"]')
    .getAttribute('content')
    .catch(() => null);
  expect((robots === 'noindex') === (version.slug !== latest), `${at}: robots is ${robots ?? 'unset'}`);

  const options = await page
    .locator('.version-picker.header select option')
    .evaluateAll((all) => all.map((o) => ({ value: o.value, selected: o.selected })));
  if (versions.length < 2)
    expect(await page.locator('.version-picker.header').isHidden(), `${at}: picker shown with one version`);
  else {
    expect(
      options.map((o) => o.value).join(' ') === versions.map((v) => v.base).join(' '),
      `${at}: picker lists ${options.map((o) => o.value).join(' ')}`,
    );
    expect(options.find((o) => o.selected)?.value === version.base, `${at}: picker does not select its own version`);
  }

  const notice = page.locator('.version-notice');
  if (version.slug === latest) expect(await notice.isHidden(), `${at}: the latest release shows a version notice`);
  else {
    expect(await notice.isVisible(), `${at}: no version notice`);
    if (latest)
      expect(
        (await notice.locator('a').getAttribute('href')) === `/${PAGE}`,
        `${at}: the notice does not link to the same page of the latest release`,
      );
  }

  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phone.goto(`${origin}${version.base}${PAGE}`, { waitUntil: 'networkidle' });
  const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow <= 0, `${at}: scrolls ${overflow}px sideways at phone width`);
  expect(await phone.locator('.version-picker.header').isHidden(), `${at}: header picker shown at phone width`);
  // A version built before the menu picker existed keeps its own components; only newer builds have one.
  if (versions.length > 1 && (await phone.locator('.version-picker.menu').count())) {
    await phone.click('button.sl-menu-button');
    expect(await phone.locator('.version-picker.menu').isVisible(), `${at}: no picker in the phone menu`);
  }
  await phone.close();

  const other = versions.find((v) => v.base !== version.base);
  if (other) {
    await Promise.all([
      page.waitForURL(`${origin}${other.base}${PAGE}`),
      page.selectOption('.version-picker.header select', other.base),
    ]);
  }
  console.log(`${at}: ${version.slug}${version.slug === latest ? ' (latest)' : ''}, picker and notice checked`);
}
await browser.close();
server.close();
problems.forEach((p) => console.error(`FAIL ${p}`));
console.log(`check-versions: ${versions.length} versions, ${problems.length} problem(s)`);
process.exit(problems.length ? 1 : 0);
