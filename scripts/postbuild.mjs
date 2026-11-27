// After astro build: writes this build's own versions.json, makes the llms.txt files' links absolute, then puts every
// internal link under DOCS_BASE.
//
// versions.json: a build on its own knows only itself, so the picker stays hidden and the banner says what this build
// is. scripts/build-site.mjs replaces the file at the site root with the list of every published version.
//
// Links:
// Pages link from the site root (/guides/costs/), so they never name a version. Astro adds the base to its own
// assets and Starlight's navigation, but not to links written in content, so a build served under /v0.3/ rewrites
// href, src and srcset values that start with a single slash and are not under the base yet. Nothing else changes.
//
// llms.txt files (starlight-llms-txt): read outside the site, so a Markdown link from the site root, ](/guides/costs/),
// becomes an absolute URL under this build's base, ](https://docs.servtuner.dev/next/guides/costs/).
import { globSync, readFileSync, writeFileSync } from 'node:fs';
import { BASE, SITE, VERSION } from './lib/site.mjs';

writeFileSync('dist/versions.json', JSON.stringify({ latest: null, versions: [{ slug: VERSION, base: BASE }] }) + '\n');

const llmsFiles = globSync(['dist/llms*.txt', 'dist/_llms-txt/*.txt']);
let llmsLinks = 0;
for (const file of llmsFiles) {
  // Images already carry the base (/next/_astro/…); content links do not (/guides/costs/).
  const text = readFileSync(file, 'utf8').replace(/\]\((\/(?!\/)[^)]*)\)/g, (whole, path) => {
    llmsLinks += 1;
    return `](${SITE}${path.startsWith(BASE) ? path : BASE + path.slice(1)})`;
  });
  writeFileSync(file, text);
}
console.log(`llms: ${llmsLinks} links in ${llmsFiles.length} files now absolute under ${SITE}${BASE}`);
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
