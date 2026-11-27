// node --test 'scripts/*.test.mjs' (part of npm run check): which versions the site publishes, from servtuner's tags.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { plan, releaseTags } from './versions.mjs';

const branches = (...names) => new Map(names.map((name) => [name, `refs/heads/${name}`]));

function repositoryWithTags(tags) {
  const dir = mkdtempSync(join(tmpdir(), 'servtuner-tags-'));
  const git = (...args) => execFileSync('git', ['-C', dir, ...args], { stdio: 'pipe' });
  git('init', '-q');
  git('-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-q', '--allow-empty', '-m', 'x');
  for (const tag of tags) git('tag', tag);
  return dir;
}

test('only vX.Y.Z tags are releases, newest first, with 0.10 above 0.9', () => {
  const dir = repositoryWithTags(['v0.9.0', 'v0.9.2', 'v0.10.0', 'v0.10.1-rc.1', 'v1.0.0-beta', 'nightly', 'v0.10']);
  try {
    assert.deepEqual(releaseTags(dir), ['v0.10.0', 'v0.9.2', 'v0.9.0']);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('latest is the newest release line, at / and at its own path; main is only next', () => {
  const site = plan(['v0.10.0', 'v0.9.2', 'v0.9.0'], branches('main', 'v0.9', 'v0.10'));
  assert.equal(site.latest, '0.10');
  assert.deepEqual(site.versions, [
    { slug: '0.10', base: '/' },
    { slug: '0.9', base: '/v0.9/' },
    { slug: 'next', base: '/next/' },
  ]);
  assert.deepEqual(
    site.builds.map((b) => [b.base, b.ref, b.tag, b.indexed]),
    [
      ['/', 'refs/heads/v0.10', 'v0.10.0', true],
      ['/v0.10/', 'refs/heads/v0.10', 'v0.10.0', false],
      ['/v0.9/', 'refs/heads/v0.9', 'v0.9.2', false],
      ['/next/', 'refs/heads/main', null, false],
    ],
  );
});

test('before the first release there is no latest, and main is still only next', () => {
  const site = plan([], branches('main'));
  assert.equal(site.latest, null);
  assert.deepEqual(
    site.builds.map((b) => b.base),
    ['/next/'],
  );
});

test('a release line without its docs branch fails and says how to cut it', () => {
  assert.throws(
    () => plan(['v0.2.0', 'v0.1.0'], branches('main', 'v0.1')),
    /no docs branch for release line v0\.2 \(v0\.2\.0\).*cut-version\.mjs <servtuner checkout> v0\.2\.0/,
  );
});
