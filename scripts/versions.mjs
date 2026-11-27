// Which documentation versions the published site has, decided by servtuner's release tags.
//   node scripts/versions.mjs <servtuner repository URL or checkout>    prints the plan as JSON
//
// - A release is a tag vMAJOR.MINOR.PATCH exactly. Pre-releases (v0.4.0-rc.1) and other tags never count.
// - Each MINOR line is one docs version, served at /vMAJOR.MINOR/ from the docs branch of the same name, synced from
//   the line's newest release. The newest line is "latest" and is also served at /.
// - main is only ever "next", at /next/. Before the first release, / is a page that says so.
// - A release line with no docs branch is an error: cut it with scripts/cut-version.mjs, never fall back to main.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const STABLE = /^v(\d+)\.(\d+)\.(\d+)$/;

/** Stable release tags of the servtuner repository, newest first. */
export function releaseTags(servtuner) {
  const out = execFileSync('git', ['ls-remote', '--tags', '--refs', servtuner], { encoding: 'utf8' });
  return out
    .split('\n')
    .map((line) => line.split('refs/tags/')[1])
    .filter((tag) => tag && STABLE.test(tag))
    .sort((a, b) => compare(b, a));
}

function compare(a, b) {
  const [, ...x] = a.match(STABLE).map(Number);
  const [, ...y] = b.match(STABLE).map(Number);
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}

/** The docs repository's branches, local or fetched from origin, as names. */
export function docsBranches() {
  const out = execFileSync('git', ['for-each-ref', '--format=%(refname)', 'refs/heads', 'refs/remotes/origin'], {
    encoding: 'utf8',
  });
  return new Map(
    out
      .split('\n')
      .filter(Boolean)
      .map((ref) => [ref.replace(/^refs\/(heads|remotes\/origin)\//, ''), ref])
      .reverse(), // a local branch wins over origin's copy
  );
}

/** The site's versions and the builds that make it. */
export function plan(tags, branches) {
  const lines = new Map();
  for (const tag of tags) {
    const [, major, minor] = tag.match(STABLE);
    const slug = `${major}.${minor}`;
    if (!lines.has(slug)) lines.set(slug, tag); // tags are newest first, so this is the line's newest release
  }
  const missing = [...lines.keys()].filter((slug) => !branches.has(`v${slug}`));
  if (missing.length)
    throw new Error(
      `no docs branch for release line ${missing.map((s) => `v${s} (${lines.get(s)})`).join(', ')}: ` +
        `run node scripts/cut-version.mjs <servtuner checkout> ${lines.get(missing[0])}`,
    );
  if (!branches.has('main')) throw new Error('no main branch: next is built from it');
  const releases = [...lines.entries()].map(([slug, tag]) => ({ slug, tag, ref: branches.get(`v${slug}`) }));
  const latest = releases[0]?.slug ?? null;
  const builds = [
    ...(latest ? [{ ...releases[0], base: '/', indexed: true }] : []),
    ...releases.map((r) => ({ ...r, base: `/v${r.slug}/`, indexed: false })),
    { slug: 'next', tag: null, ref: branches.get('main'), base: '/next/', indexed: false },
  ];
  const versions = [
    ...releases.map((r) => ({ slug: r.slug, base: r.slug === latest ? '/' : `/v${r.slug}/` })),
    { slug: 'next', base: '/next/' },
  ];
  return { latest, versions, builds };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const servtuner = process.argv[2];
  if (!servtuner) {
    console.error('usage: node scripts/versions.mjs <servtuner repository URL or checkout>');
    process.exit(2);
  }
  console.log(JSON.stringify(plan(releaseTags(servtuner), docsBranches()), null, 2));
}
