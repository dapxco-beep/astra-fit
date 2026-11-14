// Servidor estático mínimo para ASTRA-FIT (sin dependencias, solo Node).
// Por qué hace falta: los navegadores bloquean fetch() de archivos .glb cuando la página
// se abre con doble clic (file://). Servido por http://localhost sí funciona.
// Uso:  node server.js   →   abre http://localhost:8080/astrafit-3d.html
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = process.env.PORT || 8080;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.wasm': 'application/wasm', '.svg': 'image/svg+xml'
};

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const file = path.normalize(path.join(ROOT, urlPath === '/' ? '/astrafit-claro.html' : urlPath));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('Prohibido'); }   // evita salir de la carpeta
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('No encontrado: ' + urlPath); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}).listen(PORT, () => console.log(`ASTRA-FIT en http://localhost:${PORT}/astrafit-3d.html  (Ctrl+C para parar)`));
