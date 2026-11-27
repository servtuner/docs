// Compares the servtuner snapshot with the BUILT site: commands, operations, schemas, chart values, UI features.
import { existsSync, globSync, readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { parse } from 'yaml';

const data = 'src/data/servtuner';
const json = (f) => JSON.parse(readFileSync(f, 'utf8'));
const { features, excluded } = json('scripts/coverage.config.json');
const html = (page) => (existsSync(`dist/${page}/index.html`) ? readFileSync(`dist/${page}/index.html`, 'utf8') : '');
const plain = (h) =>
  h
    .replace(/<[^>]+>/g, '')
    .replaceAll('&#39;', "'")
    .replaceAll('&amp;', '&');
const headings = (page) =>
  [...html(page).matchAll(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/g)].map((m) => plain(m[1]).trim());
const results = [];
const check = (group, name, ok) => {
  const key = `${group}:${name}`;
  results.push({ group, key, state: ok ? 'documented' : excluded[key] ? 'excluded' : 'MISSING' });
};

const cli = headings('reference/cli');
for (const c of json(`${data}/cli.json`)) check('cli', c.name, cli.includes(`servtuner ${c.name}`));
const api = globSync('dist/reference/api/*/').flatMap((d) => headings(d.replace(/^dist\//, '').replace(/\/$/, '')));
for (const [path, methods] of Object.entries(json(`${data}/openapi.json`).paths))
  for (const m of Object.keys(methods))
    check('api', `${m.toUpperCase()} ${path}`, api.includes(`${m.toUpperCase()} ${path}`));
for (const f of globSync(`${data}/schemas/**/*.json`)) {
  const name = basename(f, '.schema.json');
  const page = plain(html(name === 'runspec' ? 'reference/runspec' : `reference/schemas/${name}`));
  check('schema', f.slice(`${data}/schemas/`.length), page.includes(f.slice(`${data}/schemas/`.length)));
}
const helm = headings('reference/helm-values');
for (const k of Object.keys(parse(readFileSync(`${data}/values.yaml`, 'utf8')))) check('helm', k, helm.includes(k));
for (const f of json(`${data}/frontend-features.json`))
  check('frontend', f, features[f] && plain(html(features[f].page)).includes(features[f].text));

for (const group of ['cli', 'api', 'schema', 'helm', 'frontend']) {
  const of = results.filter((r) => r.group === group);
  const n = (s) => of.filter((r) => r.state === s).length;
  console.log(
    `${group.padEnd(9)} total ${of.length}  documented ${n('documented')}  excluded ${n('excluded')}  missing ${n('MISSING')}`,
  );
}
for (const r of results.filter((r) => r.state === 'excluded')) console.log(`excluded  ${r.key}: ${excluded[r.key]}`);
const missing = results.filter((r) => r.state === 'MISSING');
missing.forEach((r) => console.error(`MISSING   ${r.key}`));
process.exit(missing.length || !results.length ? 1 : 0);
