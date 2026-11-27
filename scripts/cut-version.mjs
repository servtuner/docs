// Cuts or refreshes the docs version for a servtuner release. Run it after tagging a release:
//   node scripts/cut-version.mjs <servtuner checkout> v0.4.0
//
// - A new release line (v0.4.0): creates the branch v0.4 from main, syncs the generated reference from the tag, and
//   commits. /v0.4/ then exists, and becomes / if 0.4 is the newest line.
// - A patch release (v0.4.1): checks out the existing v0.4 branch, re-syncs it from the new tag, and commits.
// Works in a temporary git worktree, so the current checkout is untouched. It never pushes: review, then push the
// branch, and the publishing workflow rebuilds the site.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const [checkout, tag] = process.argv.slice(2);
const stable = tag?.match(/^v(\d+)\.(\d+)\.\d+$/);
if (!checkout || !stable) {
  console.error('usage: node scripts/cut-version.mjs <servtuner checkout> vMAJOR.MINOR.PATCH (a stable release tag)');
  process.exit(2);
}
const branch = `v${stable[1]}.${stable[2]}`;
const git = (args, options = {}) => execFileSync('git', args, { encoding: 'utf8', ...options }).trim();
git(['-C', checkout, 'rev-parse', '--verify', '--quiet', `refs/tags/${tag}`]); // fails when the tag is not there

const exists = git(['branch', '--list', branch]) !== '';
const tree = join(mkdtempSync(join(tmpdir(), 'servtuner-docs-cut-')), branch);
try {
  git(['worktree', 'add', '--quiet', ...(exists ? [tree, branch] : ['-b', branch, tree, 'main'])]);
  symlinkSync(resolve('node_modules'), join(tree, 'node_modules'));
  execFileSync('node', ['scripts/sync.mjs', resolve(checkout), '--ref', tag], { cwd: tree, stdio: 'inherit' });
  git(['-C', tree, 'add', '-A']);
  const changed = git(['-C', tree, 'status', '--porcelain']) !== '';
  if (changed) git(['-C', tree, 'commit', '--quiet', '-m', `Sync the ${branch} docs from servtuner ${tag}`]);
  console.log(
    `cut-version: ${exists ? 'updated' : 'created'} ${branch}${changed ? '' : ' (already in sync)'}. ` +
      `Review it (git log ${branch}), then push it: git push origin ${branch}`,
  );
} finally {
  if (existsSync(tree)) git(['worktree', 'remove', '--force', tree]);
}
