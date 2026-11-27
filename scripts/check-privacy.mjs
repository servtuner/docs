// Scans tracked and new files, and the built site, for secrets and private details.
import { execFileSync } from 'node:child_process';
import { existsSync, globSync, readFileSync, statSync } from 'node:fs';

const rules = [
  ['home path', /\/(?:home|Users)\/[a-z][\w.-]*|\/root\/|[A-Z]:\\Users\\/],
  // The project's own addresses (conduct@servtuner.dev) are published on purpose; any other address is private.
  [
    'email',
    /\b[\w.+-]+@(?!example\.|astrojs\b|servtuner\.dev(?![\w-]|\.[\w-]))[\w-]+\.(?:com|org|net|io|dev|ai|edu)\b/,
  ],
  ['private address', /\b(?:10\.\d{1,3}|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b/],
  [
    'public address',
    /\b(?!127\.|0\.0\.0\.0|255\.)(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-5])(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\b/,
  ],
  ['private key', /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/],
  [
    'token',
    /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_\w{20,}|sk-(?:ant-)?[A-Za-z0-9_-]{20,}|hf_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|xox[abprs]-[\w-]{10,}|eyJ[\w-]{15,}\.eyJ[\w-]{15,})/,
  ],
  ['AWS account', /\barn:aws:[a-z0-9-]*:[a-z0-9-]*:\d{12}\b/],
  ['internal process', /claude\.ai\/|CLAUDE\.md|\bcoordinator\b|\bimplementer\b/i],
  ['design document', /docs\/[A-Z][A-Z-]+\.md/],
  ['plan reference', /\b(?:SPEC|PLAN)\b(?: ?§| [A-Z]{1,3}\d)|§ ?\d|\bPROGRESS\.md\b/],
];
const self = /^scripts\/(?:check-privacy\.mjs|lib\/generate\.mjs)$/;
const tracked = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { encoding: 'utf8' }).trim().split('\n');
const built = globSync('dist/**/*').filter((f) => statSync(f).isFile());
const files = [...tracked, ...built].filter((f) => existsSync(f) && !self.test(f) && f !== 'package-lock.json');
const text = files.filter((f) => !/\.(png|webp|jpg|woff2?|pf_\w+|pagefind|wasm|ico)$/.test(f));
const binary = files.filter((f) => /\.(png|webp|jpg)$/.test(f));
const hits = [];
for (const f of text)
  readFileSync(f, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      for (const [name, rule] of rules) {
        const m = rule.exec(line);
        // Author credit inside the bundled Pagefind library, published by its vendor.
        if (m?.[0] === 'jan@cloudcannon.com' && /^dist\/(?:pagefind|_astro)\//.test(f)) continue;
        if (m) hits.push(`${f}:${i + 1}: ${name}: ${m[0].slice(0, 80)}`);
      }
    });
for (const f of binary) {
  const bytes = readFileSync(f).toString('latin1');
  for (const [name, rule] of rules.filter(([n]) => ['home path', 'token', 'private key'].includes(n)))
    if (rule.test(bytes)) hits.push(`${f}: ${name} in image bytes`);
}
hits.forEach((h) => console.error(`PRIVATE ${h}`));
console.log(
  `check-privacy: ${text.length} text files (${built.length} built files included), ${binary.length} images, ${hits.length} hit(s)`,
);
process.exit(hits.length || !built.length ? 1 : 0);
