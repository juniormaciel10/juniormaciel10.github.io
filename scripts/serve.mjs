import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const portIndex = process.argv.indexOf('--port');
const port = portIndex >= 0 ? Number(process.argv[portIndex + 1]) : 4175;
await fs.access(path.join(root, 'index.html'));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.xml': 'application/xml; charset=utf-8', '.mp4': 'video/mp4', '.vtt': 'text/vtt; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.pdf': 'application/pdf', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.txt': 'text/plain; charset=utf-8' };
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://127.0.0.1:${port}`);
    const name = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    let file = path.resolve(root, '.' + name);
    if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
    if ((await fs.stat(file)).isDirectory()) {
      if (!url.pathname.endsWith('/')) { response.writeHead(308, { Location: url.pathname + '/' + url.search }).end(); return; }
      file = path.join(file, 'index.html');
    }
    const data = await fs.readFile(file);
    const range = request.method === 'GET' ? request.headers.range : undefined;
    let status = 200, first = 0, last = data.length - 1;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (match && (match[1] || match[2])) {
        if (match[1]) { first = Number(match[1]); last = match[2] ? Math.min(Number(match[2]), last) : last; }
        else { first = Math.max(0, data.length - Number(match[2])); }
      }
      if (!match || !(match[1] || match[2]) || !Number.isSafeInteger(first) || !Number.isSafeInteger(last) || first > last || first >= data.length || (!match[1] && Number(match[2]) === 0)) {
        response.writeHead(416, { 'Content-Range': `bytes */${data.length}`, 'Content-Length': 0, 'Accept-Ranges': 'bytes' }).end(); return;
      }
      status = 206;
    }
    const acceptsGzip = String(request.headers['accept-encoding'] || '').split(',').some(value => value.trim().startsWith('gzip') && !/q=0(?:\.0+)?$/.test(value.trim()));
    const compressed = !range && acceptsGzip && /\.(?:html|css|js|json|xml|txt)$/.test(file);
    const body = compressed ? gzipSync(data) : data.subarray(first, last + 1);
    const headers = { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Content-Length': body.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes', Vary: 'Accept-Encoding' };
    if (compressed) headers['Content-Encoding'] = 'gzip';
    if (status === 206) headers['Content-Range'] = `bytes ${first}-${last}/${data.length}`;
    response.writeHead(status, headers);
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' || error.code === 'EISDIR' ? 404 : 400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Arquivo não encontrado.');
  }
});
server.listen(port, '127.0.0.1', () => console.log(`Prévia: http://127.0.0.1:${port}/`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
