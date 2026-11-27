// Regenerates src/data/servtuner and the generated reference pages from a servtuner checkout.
//   npm run sync -- /path/to/servtuner [--ref <commit>]
// Reads committed files only (git archive into a temporary directory); the checkout is never written to.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { generate } from './lib/generate.mjs';

const args = process.argv.slice(2);
const refAt = args.indexOf('--ref');
const ref = refAt >= 0 ? args.splice(refAt, 2)[1] : 'HEAD';
if (!args[0]) {
  console.error('usage: npm run sync -- /path/to/servtuner [--ref <commit>]');
  process.exit(2);
}
const source = resolve(args[0]);
const git = (...a) => execFileSync('git', ['--no-optional-locks', '-C', source, ...a], { encoding: 'utf8' }).trim();
const sha = git('rev-parse', `${ref}^{commit}`);
const committed = git('log', '-1', '--format=%cI', sha);
const data = resolve('src/data/servtuner');
const work = mkdtempSync(join(tmpdir(), 'servtuner-docs-sync-'));
const writeJson = (path, value) => writeFileSync(join(data, path), JSON.stringify(value, null, 2) + '\n');
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

try {
  const tar = execFileSync(
    'git',
    [
      '--no-optional-locks',
      '-C',
      source,
      'archive',
      sha,
      'api/openapi.json',
      'schema/json',
      'schema/presets',
      'deploy/helm/servtuner/values.yaml',
      'deploy/helm/servtuner/Chart.yaml',
      'deploy/helm/servtuner/README.md',
      'frontend/src/features',
      'bench',
    ],
    { maxBuffer: 1 << 30 },
  );
  execFileSync('tar', ['-x', '-C', work], { input: tar });
  rmSync(data, { recursive: true, force: true });
  for (const d of ['schemas/bundle', 'presets']) mkdirSync(join(data, d), { recursive: true });

  writeJson('openapi.json', readJson(join(work, 'api/openapi.json')));
  for (const dir of ['', 'bundle'])
    for (const f of readdirSync(join(work, 'schema/json', dir)).filter((n) => n.endsWith('.json')))
      writeJson(join('schemas', dir, f), readJson(join(work, 'schema/json', dir, f)));
  for (const f of readdirSync(join(work, 'schema/presets')))
    writeFileSync(
      join(data, 'presets', f),
      readFileSync(join(work, 'schema/presets', f), 'utf8')
        .split('\n')
        .filter((l) => !/^\s*#/.test(l))
        .map((l) => l.replace(/\s+#.*$/, ''))
        .join('\n'),
    );
  writeFileSync(join(data, 'values.yaml'), readFileSync(join(work, 'deploy/helm/servtuner/values.yaml'), 'utf8'));
  cpSync(join(work, 'deploy/helm/servtuner/Chart.yaml'), join(data, 'Chart.yaml'));

  const env = readFileSync(join(work, 'deploy/helm/servtuner/README.md'), 'utf8')
    .split('\n')
    .filter((l) => /^\| `[A-Z]/.test(l))
    .map((l) =>
      l
        .slice(1, l.lastIndexOf('|'))
        .split(/(?<!\\)\|/)
        .map((c) => c.trim().replaceAll('\\|', '|')),
    )
    .map(([name, meaning, values, readBy]) => ({ name, meaning, values, readBy }));
  if (!env.length) throw new Error('environment contract table not found in the chart README');
  writeJson('environment.json', env);
  writeJson('frontend-features.json', readdirSync(join(work, 'frontend/src/features')).sort());

  // The CLI reference is the help text of the binary built from this commit.
  const bench = join(work, 'bench-binary');
  execFileSync('go', ['build', '-o', bench, './cmd/servtuner'], {
    cwd: join(work, 'bench'),
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  const help = (...a) =>
    execFileSync(bench, [...a, '--help'], { encoding: 'utf8', env: { PATH: process.env.PATH, HOME: work } });
  const root = help();
  const names = [
    ...root
      .split('Available Commands:')[1]
      .split('\nFlags:')[0]
      .matchAll(/^ {2}([a-z][a-z-]*)\s+(.+)$/gm),
  ];
  writeJson(
    'cli.json',
    names.map(([, name, short]) => ({ name, short, help: help(name) })),
  );

  writeJson('meta.json', { sha, committed, chart: basename('servtuner') });
  generate(data);
  execFileSync(
    'npx',
    ['prettier', '--write', '--log-level', 'warn', 'src/data/servtuner', 'src/content/docs/reference'],
    {
      stdio: 'inherit',
    },
  );
  console.log(`synced servtuner ${sha}`);
} finally {
  if (existsSync(work)) rmSync(work, { recursive: true, force: true });
}
