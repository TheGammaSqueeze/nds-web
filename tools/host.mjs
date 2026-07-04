// Standalone static host for the DSi web BIOS. Binds 0.0.0.0 on a fixed port
// so it's reachable from the Windows host (WSL2 forwards localhost).
// Usage: node tools/host.mjs [port]
import http from 'http';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve('/work/nds/webapp');
const PORT = Number(process.argv[2]) || 8080;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.ico': 'image/x-icon',
};

const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const fp = path.join(ROOT, p);
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end('403'); }
  fs.readFile(fp, (e, d) => {
    if (e) { res.writeHead(404); return res.end('404 Not Found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(d);
  });
});

srv.on('error', (e) => { console.error('server error:', e.message); process.exit(1); });
srv.listen(PORT, '0.0.0.0', () => {
  console.log(`DSi web BIOS hosted at http://localhost:${PORT}/  (root: ${ROOT})`);
});
