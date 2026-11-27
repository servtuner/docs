// Serves a build as GitHub Pages does: dist/ under DOCS_BASE (/ by default). A missing file, or any path outside
// the base, is a 404, so a link that missed the base shows up as broken. `serve(port, dir, base)` serves another
// directory, such as the assembled multi-version site.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { BASE } from './lib/site.mjs';

const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
};
export function serve(port = 0, dir = 'dist', base = BASE) {
  const server = createServer((request, response) => {
    const path = decodeURIComponent(new URL(request.url, 'http://x').pathname);
    let file = path.startsWith(base) ? join(dir, normalize(path.slice(base.length) || '.')) : '';
    // The published site always has /versions.json at its root; a build served alone under a sub-path answers with
    // its own copy, as it would find in the assembled site.
    if (path === '/versions.json' && base !== '/') file = join(dir, 'versions.json');
    if (file && file !== dir && !file.startsWith(`${dir}/`)) file = '';
    if (file && existsSync(file) && statSync(file).isDirectory()) {
      if (!path.endsWith('/')) return response.writeHead(301, { location: `${path}/` }).end();
      file = join(file, 'index.html');
    }
    const ok = file && existsSync(file);
    response.writeHead(ok ? 200 : 404, {
      'content-type': TYPES[extname(ok ? file : '.html')] ?? 'application/octet-stream',
    });
    response.end(readFileSync(ok ? file : join(dir, '404.html')));
  });
  return new Promise((resolve) =>
    server.listen(port, '127.0.0.1', () =>
      resolve({ server, url: `http://127.0.0.1:${server.address().port}${base}` }),
    ),
  );
}
if (process.argv[1]?.endsWith('serve.mjs'))
  console.log(
    (await serve(Number(process.argv[2] ?? 4321), process.argv[3] ?? 'dist', process.argv[3] ? '/' : BASE)).url,
  );
