/**
 * local/server.js — Simula Apps Script en tu computador. Solo necesita Node (sin instalar paquetes).
 *
 *   node local/server.js      →  abre http://localhost:3000
 *
 * Qué imita:
 *   1. doGet() + include():  sirve apps-script/Index.html (o Componentes.html con ?page=componentes) y reemplaza cada <?!= include('X'); ?>
 *      por el contenido de apps-script/X.html, igual que Apps Script.
 *   2. google.script.run:    JsApi.html llama a POST /api/<función>; aquí están las mismas
 *      funciones de Code.gs, pero trabajando sobre un JSON en vez del Sheet.
 *
 * Datos: lee local/datos-local.json (tus cambios). Si no existe, lo crea copiando datos-ejemplo.json.
 * Para volver a los datos de ejemplo, borra local/datos-local.json.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const APPS = path.join(RAIZ, 'apps-script');
const EJEMPLO = path.join(__dirname, 'datos-ejemplo.json');
const LOCAL = path.join(__dirname, 'datos-local.json');
const PUERTO = process.env.PORT || 3000;

/* ------------------------------------------------------------ "Sheet" local */
function leerBD() {
  if (!fs.existsSync(LOCAL)) fs.copyFileSync(EJEMPLO, LOCAL);
  return JSON.parse(fs.readFileSync(LOCAL, 'utf8'));
}
function escribirBD(bd) { fs.writeFileSync(LOCAL, JSON.stringify(bd, null, 1)); }
function ahora() {
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/* Mismas funciones y mismos nombres que Code.gs */
const funciones = {
  obtenerDatos() { return leerBD(); },
  guardarAstronauta(astronauta) {
    const bd = leerBD();
    const mayor = Math.max(0, ...bd.Astronautas.map((a) => parseInt(String(a.id_astronauta).replace(/\D/g, ''), 10) || 0));
    astronauta.id_astronauta = 'AST-' + String(mayor + 1).padStart(3, '0');
    astronauta.activo = astronauta.activo || 'SI';
    bd.Astronautas.push(astronauta);
    escribirBD(bd);
    return { ok: true, astronauta };
  },
  guardarSeguimiento(registro) {
    const bd = leerBD();
    registro.registrado_en = ahora();
    bd.Seguimiento.push(registro);
    escribirBD(bd);
    return { ok: true, registro };
  },
  guardarSesion(sesion, filasEmg) {
    const bd = leerBD();
    sesion.registrado_en = ahora();
    bd.Sesiones.push(sesion);
    (filasEmg || []).forEach((f) => bd.EMG.push(f));
    escribirBD(bd);
    return { ok: true, sesion };
  },
  guardarAlertas(lista) {
    const bd = leerBD();
    let mayor = Math.max(0, ...bd.Alertas.map((a) => parseInt(String(a.id_alerta).replace(/\D/g, ''), 10) || 0));
    const guardadas = (lista || []).map((a) => { mayor += 1; a.id_alerta = 'ALR-' + String(mayor).padStart(4, '0'); bd.Alertas.push(a); return a; });
    escribirBD(bd);
    return { ok: true, alertas: guardadas };
  },
  actualizarAlerta(idAlerta, cambios) {
    const bd = leerBD();
    const alerta = bd.Alertas.find((a) => a.id_alerta === idAlerta);
    if (!alerta) throw new Error('No existe la alerta ' + idAlerta);
    Object.assign(alerta, cambios);
    escribirBD(bd);
    return { ok: true };
  }
};

/* ------------------------------------------------------------ include() */
function renderizar(nombre, profundidad = 0) {
  if (profundidad > 10) throw new Error('include() anidado demasiadas veces');
  const archivo = path.join(APPS, nombre + '.html');
  if (!fs.existsSync(archivo)) throw new Error(`include('${nombre}'): no existe apps-script/${nombre}.html`);
  return fs.readFileSync(archivo, 'utf8')
    .replace(/<\?!=\s*include\(\s*['"]([^'"]+)['"]\s*\)\s*;?\s*\?>/g, (_, n) => renderizar(n, profundidad + 1));
}

/* ------------------------------------------------------------ servidor */
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };

http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);

  // google.script.run simulado
  if (req.method === 'POST' && url.startsWith('/api/')) {
    let cuerpo = '';
    req.on('data', (c) => { cuerpo += c; });
    req.on('end', () => {
      const fn = funciones[url.slice(5)];
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      if (!fn) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Función no encontrada: ' + url.slice(5) })); }
      try {
        const args = cuerpo ? JSON.parse(cuerpo) : [];
        res.end(JSON.stringify(fn(...args)));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Página principal (como doGet): ?page=componentes abre la guía de componentes
  if (url === '/' || url === '/index.html') {
    const PAGINAS = { componentes: 'Componentes' };
    const pagina = PAGINAS[new URL(req.url, 'http://x').searchParams.get('page')] || 'Index';
    try {
      const html = renderizar(pagina);
      res.writeHead(200, { 'Content-Type': TIPOS['.html'], 'Cache-Control': 'no-cache' });
      return res.end(html);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Error armando la página: ' + e.message);
    }
  }

  // Archivos sueltos. /assets/... se busca en la carpeta NASA/assets (modelos 3D del equipo del cuerpo)
  const base = url.startsWith('/assets/') ? path.join(RAIZ, '..') : RAIZ;
  const archivo = path.normalize(path.join(base, url));
  if (!archivo.startsWith(base)) { res.writeHead(403); return res.end('Prohibido'); }
  fs.readFile(archivo, (err, data) => {
    if (err) { res.writeHead(404); return res.end('No encontrado: ' + url); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}).listen(PUERTO, () => console.log(`ASTRA-FIT local en http://localhost:${PUERTO}  (Ctrl+C para detener)`));
