// Crawls every built page, served under DOCS_BASE, and checks internal links, anchors and assets.
import { globSync, readFileSync } from 'node:fs';
import { BASE, SITE } from './lib/site.mjs';
import { serve } from './serve.mjs';

const { server, url } = await serve();
const origin = new URL(url).origin;
const pages = globSync('dist/**/*.html').sort();
const ids = new Map();
const decode = (s) => s.replaceAll('&amp;', '&').replaceAll('&#38;', '&').replaceAll('&quot;', '"');
const pageUrl = (f) => `${origin}${BASE}${f.slice(5).replace(/index\.html$/, '')}`;
for (const f of pages)
  ids.set(pageUrl(f), new Set([...readFileSync(f, 'utf8').matchAll(/\sid="([^"]*)"/g)].map((m) => decode(m[1]))));
const status = new Map();
const get = async (u) => {
  if (!status.has(u)) status.set(u, (await fetch(u)).status);
  return status.get(u);
};
let links = 0;
let anchors = 0;
const broken = [];
for (const f of pages) {
  const here = pageUrl(f);
  const html = readFileSync(f, 'utf8').replace(
    /<script\b[^>]*>[\s\S]*?<\/script>/g,
    (s) => /^<script[^>]*>/.exec(s)[0],
  );
  // The 404 page's canonical URL names itself; GitHub Pages serves that page for missing paths, so it is not a link.
  const body =
    f === 'dist/404.html'
      ? html.replace(/<link rel="canonical"[^>]*>/, '').replace(/<meta property="og:url"[^>]*>/, '')
      : html;
  const refs = [...body.matchAll(/\s(?:href|src)="([^"]*)"/g)].map((m) => m[1]);
  for (const m of body.matchAll(/\ssrcset="([^"]*)"/g))
    refs.push(...m[1].split(',').map((x) => x.trim().split(/\s+/)[0]));
  for (const ref of refs) {
    if (/^(mailto:|data:|javascript:)/.test(ref)) continue;
    let target = new URL(decode(ref), here);
    if (target.origin === SITE) target = new URL(target.pathname + target.hash, origin);
    if (target.origin !== origin) continue;
    links += 1;
    const hash = decodeURIComponent(target.hash.slice(1));
    target.hash = '';
    if ((await get(target.href)) !== 200) broken.push(`${f}: ${ref}`);
    else if (hash && hash !== '_top') {
      anchors += 1;
      if (!ids.get(target.href)?.has(hash)) broken.push(`${f}: ${ref} (no such anchor)`);
    }
  }
}
for (const f of globSync('dist/_astro/*.css'))
  for (const m of readFileSync(f, 'utf8').matchAll(/url\(["']?([^"')]+)["']?\)/g))
    if (!m[1].startsWith('data:') && !m[1].startsWith('#')) {
      links += 1;
      if ((await get(new URL(m[1], `${origin}${BASE}${f.slice(5)}`).href)) !== 200) broken.push(`${f}: ${m[1]}`);
    }
server.close();
[...new Set(broken)].forEach((b) => console.error(`BROKEN ${b}`));
console.log(
  `check-links: ${pages.length} pages, ${links} internal references, ${anchors} anchors, ${status.size} distinct URLs, ${broken.length} broken`,
);
process.exit(broken.length || !pages.length ? 1 : 0);
