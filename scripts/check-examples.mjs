// Every JSON or YAML block is either validated against a servtuner schema ({/* schema: name */} above it) or is
// recognizably not one. Anything that looks like a RunSpec must be annotated.
//   BENCH=/path/to/servtuner additionally runs `servtuner validate` on every RunSpec.
import { execFileSync } from 'node:child_process';
import { globSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { parseAllDocuments } from 'yaml';

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
for (const f of globSync('src/data/servtuner/schemas/**/*.json')) {
  const s = JSON.parse(readFileSync(f, 'utf8'));
  ajv.addSchema(s, s.$id ?? basename(f));
}
const byName = Object.fromEntries(
  globSync('src/data/servtuner/schemas/**/*.json').map((f) => [
    basename(f, '.schema.json'),
    JSON.parse(readFileSync(f, 'utf8')).$id,
  ]),
);
ajv.addSchema(JSON.parse(readFileSync('src/data/servtuner/openapi.json', 'utf8')), 'openapi');
const bench = process.env.BENCH;
const work = mkdtempSync(join(tmpdir(), 'servtuner-docs-examples-'));
let count = 0;
let benchCount = 0;
let other = 0;
const errors = [];
const fence = /(?:\{\/\* schema: ([\w:-]+) \*\/\}\s*\n\s*\n)?^([ \t]*)```(ya?ml|json)\b[^\n]*\n([\s\S]*?)^\2```/gm;
for (const file of globSync('src/content/docs/**/*.{md,mdx}').sort()) {
  const text = readFileSync(file, 'utf8');
  const annotated = (text.match(/\{\/\* schema: /g) ?? []).length;
  let matched = 0;
  for (const m of text.matchAll(fence)) {
    const [, schema, indent, , raw] = m;
    const body = raw
      .split('\n')
      .map((l) => l.slice(indent.length))
      .join('\n');
    const where = `${file}:${text.slice(0, m.index).split('\n').length}`;
    const docs = parseAllDocuments(body);
    if (docs.some((d) => d.errors.length)) {
      errors.push(`${where}: does not parse`);
      continue;
    }
    if (schema) matched += 1;
    else {
      if (/kind: RunSpec|"kind": "RunSpec"|servtuner\/v1/.test(body))
        errors.push(`${where}: RunSpec without a schema annotation`);
      other += 1;
      continue;
    }
    const value = docs[0].toJS();
    const ref = schema.startsWith('openapi:') ? `openapi#/components/schemas/${schema.slice(8)}` : byName[schema];
    const validate = ref && (ajv.getSchema(ref) ?? ajv.compile({ $ref: ref }));
    if (!validate) {
      errors.push(`${where}: unknown schema ${schema}`);
      continue;
    }
    count += 1;
    if (!validate(value)) errors.push(`${where}: ${schema}: ${ajv.errorsText(validate.errors)}`);
    const spec = schema === 'runspec' ? value : value.spec?.kind === 'RunSpec' ? value.spec : undefined;
    if (spec) {
      if (!ajv.getSchema(byName.runspec)(spec)) errors.push(`${where}: embedded RunSpec is invalid`);
      if (bench) {
        const path = join(work, `${count}.json`);
        writeFileSync(path, JSON.stringify(spec));
        try {
          execFileSync(bench, ['validate', '--spec', path], { stdio: 'pipe' });
          benchCount += 1;
        } catch (e) {
          errors.push(`${where}: servtuner validate: ${e.stderr ?? e}`);
        }
      }
    }
  }
  if (matched !== annotated) errors.push(`${file}: ${annotated} schema annotations but ${matched} matched blocks`);
}
rmSync(work, { recursive: true, force: true });
errors.forEach((e) => console.error(e));
console.log(
  `check-examples: ${count} validated against a schema, ${benchCount} by servtuner validate${bench ? '' : ' (BENCH not set)'}, ${other} other blocks parsed, ${errors.length} problem(s)`,
);
process.exit(errors.length ? 1 : 0);
