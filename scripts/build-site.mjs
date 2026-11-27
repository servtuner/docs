// Builds every documentation version and assembles the published site in site/.
//   node scripts/build-site.mjs <servtuner repository URL or checkout> [--checks]
//
// The versions come from scripts/versions.mjs: the latest stable release at / (and /vX.Y/), each older release
// line at /vX.Y/, and main at /next/. Each version is built from its own branch in a temporary git worktree, so the
// branch's own content, generated reference and scripts are used. With --checks, each build also runs the link,
// coverage and privacy checks under its base, and the assembled site its version checks (scripts/check-versions.mjs).
// Writes site/versions.json for the picker and banner.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { docsBranches, plan, releaseTags } from './versions.mjs';

const [servtuner, ...flags] = process.argv.slice(2);
if (!servtuner) {
  console.error('usage: node scripts/build-site.mjs <servtuner repository URL or checkout> [--checks]');
  process.exit(2);
}
const checks = flags.includes('--checks');
const out = resolve('site');
const work = mkdtempSync(join(tmpdir(), 'servtuner-docs-site-'));
const run = (command, args, options = {}) => execFileSync(command, args, { stdio: 'inherit', ...options });

const site = plan(releaseTags(servtuner), docsBranches());
console.log(
  `build-site: latest ${site.latest ?? '(no release yet)'}; builds ${site.builds.map((b) => b.base).join(' ')}`,
);
rmSync(out, { recursive: true, force: true });

try {
  for (const build of site.builds) {
    const tree = join(work, build.base.replace(/\//g, '_'));
    run('git', ['worktree', 'add', '--detach', '--quiet', tree, build.ref]);
    // Its own install: Astro cannot build through a node_modules linked from another checkout.
    run('npm', ['ci', '--prefer-offline', '--no-audit', '--no-fund', '--loglevel=error'], { cwd: tree });
    const env = {
      ...process.env,
      DOCS_BASE: build.base,
      DOCS_VERSION: build.slug,
      DOCS_INDEXED: String(build.indexed),
    };
    console.log(
      `build-site: ${build.base} from ${build.ref}${build.tag ? ` (synced from servtuner ${build.tag})` : ''}`,
    );
    run('npm', ['run', 'build', '--silent'], { cwd: tree, env });
    if (checks) run('npm', ['run', 'check:site', '--silent'], { cwd: tree, env });
    cpSync(join(tree, 'dist'), join(out, build.base), { recursive: true });
  }
} finally {
  for (const build of site.builds) {
    const tree = join(work, build.base.replace(/\//g, '_'));
    if (existsSync(tree)) run('git', ['worktree', 'remove', '--force', tree]);
  }
  rmSync(work, { recursive: true, force: true });
}

if (!site.latest) {
  // No stable release yet: / never shows main, it says there is no release and links to next.
  writeFileSync(
    join(out, 'index.html'),
    `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>servtuner documentation</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:40rem;margin:4rem auto;padding:0 1rem;color:#141b2b}
@media (prefers-color-scheme:dark){body{background:#17181c;color:#f4f7ff}a{color:#7ea0ff}}</style></head>
<body><h1>servtuner documentation</h1>
<p>servtuner has no stable release yet. Read the <a href="/next/">documentation for unreleased servtuner (main)</a>.</p>
</body></html>
`,
  );
  cpSync(join(out, 'next', '404.html'), join(out, '404.html'));
  // llms.txt is looked for at the site root; until a release is at /, it points at next's files.
  writeFileSync(
    join(out, 'llms.txt'),
    readFileSync(join(out, 'next', 'llms.txt'), 'utf8').replace(
      /^(> .*\n)/m,
      '$1\nservtuner has no stable release yet; these files document unreleased servtuner (main).\n',
    ),
  );
}
cpSync('public/CNAME', join(out, 'CNAME'));
writeFileSync(
  join(out, 'versions.json'),
  JSON.stringify({ latest: site.latest, versions: site.versions }, null, 2) + '\n',
);
if (checks) run('node', ['scripts/check-versions.mjs']);
console.log(`build-site: wrote ${out} (${site.versions.map((v) => `${v.slug} at ${v.base}`).join(', ')})`);
