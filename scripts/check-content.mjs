// Every page has a title and a description, and descriptions are unique and of usable length.
import { readFileSync, globSync } from 'node:fs';
import { parse } from 'yaml';

const files = globSync('src/content/docs/**/*.{md,mdx}').sort();
const errors = [];
const seen = new Map();
for (const file of files) {
  const front = /^---\n([\s\S]*?)\n---/.exec(readFileSync(file, 'utf8'));
  const data = front ? parse(front[1]) : {};
  if (!data.title) errors.push(`${file}: no title`);
  if (!data.description || data.description.length < 20)
    errors.push(`${file}: no description of at least 20 characters`);
  else if (seen.has(data.description)) errors.push(`${file}: same description as ${seen.get(data.description)}`);
  else seen.set(data.description, file);
}
errors.forEach((e) => console.error(e));
console.log(`check-content: ${files.length} pages, ${errors.length} problem(s)`);
process.exit(errors.length ? 1 : 0);
