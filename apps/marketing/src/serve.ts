import { createServer } from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Zero-dependency static server for local preview of dist/ (`pnpm dev`).
 * Mirrors static-host behaviour: /route serves route/index.html and unknown
 * routes serve 404.html with a 404 status. Not a production server.
 */

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const port = Number(process.env['PORT'] ?? 4173);

const MIME: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};

function resolveFile(urlPath: string): { readonly path: string; readonly status: number } {
  const clean = normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  const direct = join(dist, clean);
  try {
    if (statSync(direct).isFile()) {
      return { path: direct, status: 200 };
    }
  } catch {
    /* fall through */
  }
  const asIndex = join(direct, 'index.html');
  try {
    if (statSync(asIndex).isFile()) {
      return { path: asIndex, status: 200 };
    }
  } catch {
    /* fall through */
  }
  return { path: join(dist, '404.html'), status: 404 };
}

createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const file = resolveFile(url.pathname);
  try {
    const body = readFileSync(file.path);
    response.writeHead(file.status, {
      'content-type': MIME[extname(file.path)] ?? 'application/octet-stream',
    });
    response.end(body);
  } catch {
    response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Server error reading site files. Run `pnpm build` first.');
  }
}).listen(port, () => {
  process.stdout.write(`Arq site preview: http://localhost:${port}\n`);
});
