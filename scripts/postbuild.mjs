// After astro build: writes this build's own versions.json, then puts every internal link under DOCS_BASE.
//
// versions.json: a build on its own knows only itself, so the picker stays hidden and the banner says what this build
// is. scripts/build-site.mjs replaces the file at the site root with the list of every published version.
//
// Links:
// Pages link from the site root (/guides/costs/), so they never name a version. Astro adds the base to its own
// assets and Starlight's navigation, but not to links written in content, so a build served under /v0.3/ rewrites
// href, src and srcset values that start with a single slash and are not under the base yet. Nothing else changes.
import { globSync, readFileSync, writeFileSync } from 'node:fs';
import { BASE, VERSION } from './lib/site.mjs';

writeFileSync('dist/versions.json', JSON.stringify({ latest: null, versions: [{ slug: VERSION, base: BASE }] }) + '\n');
if (BASE === '/') process.exit(0);

const prefix = (value) =>
  value.startsWith('/') && !value.startsWith('//') && !value.startsWith(BASE) ? BASE + value.slice(1) : value;
const attribute = /(\s(?:href|src|action)=)(["'])(\/[^"']*)\2/g;
const srcset = /(\ssrcset=)(["'])([^"']*)\2/g;

let files = 0;
let links = 0;
for (const file of globSync('dist/**/*.html')) {
  const html = readFileSync(file, 'utf8');
  const rebased = html
    .replace(attribute, (whole, name, quote, value) => {
      const next = prefix(value);
      if (next !== value) links += 1;
      return `${name}${quote}${next}${quote}`;
    })
    .replace(srcset, (whole, name, quote, value) => {
      const next = value
        .split(',')
        .map((entry) => entry.replace(/^(\s*)(\S+)/, (all, space, url) => space + prefix(url)))
        .join(',');
      return `${name}${quote}${next}${quote}`;
    });
  if (rebased !== html) {
    writeFileSync(file, rebased);
    files += 1;
  }
}
console.log(`rebase: ${links} links in ${files} files now under ${BASE}`);
