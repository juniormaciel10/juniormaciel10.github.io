import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const portIndex = process.argv.indexOf('--port');
const port = portIndex >= 0 ? Number(process.argv[portIndex + 1]) : 4175;
await fs.access(path.join(root, 'index.html'));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.pdf': 'application/pdf', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.txt': 'text/plain; charset=utf-8' };
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://127.0.0.1:${port}`);
    const name = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const file = path.resolve(root, '.' + name);
    if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
    const data = await fs.readFile(file);
    const acceptsGzip = String(request.headers['accept-encoding'] || '').split(',').some(value => value.trim().startsWith('gzip') && !/q=0(?:\.0+)?$/.test(value.trim()));
    const compressed = acceptsGzip && /\.(?:html|css|js|json|txt)$/.test(file);
    const body = compressed ? gzipSync(data) : data;
    const headers = { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Content-Length': body.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Accept-Encoding' };
    if (compressed) headers['Content-Encoding'] = 'gzip';
    response.writeHead(200, headers);
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' || error.code === 'EISDIR' ? 404 : 400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Arquivo não encontrado.');
  }
});
server.listen(port, '127.0.0.1', () => console.log(`Prévia: http://127.0.0.1:${port}/`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
