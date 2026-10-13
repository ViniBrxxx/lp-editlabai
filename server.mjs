import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('./dist/', import.meta.url));
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.mp4': 'video/mp4', '.webp': 'image/webp', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.ico': 'image/x-icon',
};

createServer(async (request, response) => {
  const reply = (code, message, headers = {}) => {
    response.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
    response.end(request.method === 'HEAD' ? undefined : message);
  };
  if (!['GET', 'HEAD'].includes(request.method)) return reply(405, 'Método não permitido.', { Allow: 'GET, HEAD' });
  let filename;
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    filename = resolve(root, `.${pathname}`);
    const subpath = relative(root, filename);
    if (subpath.startsWith('..') || isAbsolute(subpath)) return reply(403, 'Acesso negado.');
  } catch { return reply(400, 'Endereço inválido.'); }

  let file;
  try {
    file = await stat(filename);
    if (file.isDirectory()) { filename = join(filename, 'index.html'); file = await stat(filename); }
    if (!file.isFile()) return reply(404, 'Arquivo não encontrado.');
  } catch { return reply(404, 'Arquivo não encontrado.'); }

  const etag = `"${file.size.toString(16)}-${Math.floor(file.mtimeMs).toString(16)}"`;
  const headers = {
    'Content-Type': types[extname(filename).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': 'public, max-age=0, must-revalidate',
    'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff', ETag: etag,
  };
  if (!request.headers.range && request.headers['if-none-match'] === etag) {
    response.writeHead(304, headers); return response.end();
  }
  let start = 0, end = file.size - 1, status = 200;
  if (request.headers.range) {
    const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
    if (!range || (!range[1] && !range[2])) return reply(416, 'Intervalo inválido.', { 'Content-Range': `bytes */${file.size}` });
    if (range[1]) {
      start = Number(range[1]); end = range[2] ? Math.min(Number(range[2]), end) : end;
    } else {
      const length = Number(range[2]); start = Math.max(0, file.size - length);
      if (length === 0) start = file.size;
    }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= file.size) {
      return reply(416, 'Intervalo inválido.', { 'Content-Range': `bytes */${file.size}` });
    }
    status = 206;
    headers['Content-Range'] = `bytes ${start}-${end}/${file.size}`;
  }
  headers['Content-Length'] = end - start + 1;
  response.writeHead(status, headers);
  if (request.method === 'HEAD') return response.end();
  const stream = createReadStream(filename, { start, end });
  stream.on('error', () => response.destroy());
  response.on('close', () => stream.destroy());
  stream.pipe(response);
}).listen(port, host, () => console.log(`EditLab AI: http://${host}:${port}`));
