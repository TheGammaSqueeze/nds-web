// tiny static file server for the webapp
import http from 'http';
import fs from 'fs';
import path from 'path';
const ROOT = path.resolve('/work/nds/webapp');
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml', '.wav':'audio/wav', '.ogg':'audio/ogg', '.mp3':'audio/mpeg', '.woff2':'font/woff2' };
const port = process.env.PORT || 8099;
http.createServer((req,res)=>{
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p==='/') p='/index.html';
  let fp = path.join(ROOT, p);
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(fp,(e,d)=>{ if(e){res.writeHead(404);return res.end('404');} res.writeHead(200,{'Content-Type':MIME[path.extname(fp)]||'application/octet-stream','Cache-Control':'no-cache'}); res.end(d); });
}).listen(port, ()=>console.log('serving /work/nds/webapp on http://localhost:'+port));
