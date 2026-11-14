/**
 * construir-cloudflare.js — Arma la carpeta publicar-cloudflare/ que se sube a Cloudflare.
 *
 *   node astra-fit/publicar/construir-cloudflare.js        (desde la raíz de NASA o desde cualquier lado)
 *
 * Qué hace (sin instalar nada, solo Node):
 *   1. Une Index.html con todas sus secciones (lo mismo que hace include() en Apps Script) y lo guarda como
 *      publicar-cloudflare/index.html. La guía de componentes queda en componentes.html.
 *   2. Copia a publicar-cloudflare/assets/ los modelos 3D que usan las secciones (si cambiaron).
 *
 * Después se publica con:   npx wrangler deploy      (desde la raíz de NASA; usa wrangler.jsonc)
 */
const fs = require('fs');
const path = require('path');

const NASA = path.join(__dirname, '..', '..');
const APPS = path.join(NASA, 'astra-fit', 'apps-script');
const SALIDA = path.join(NASA, 'publicar-cloudflare');

function renderizar(nombre, profundidad = 0) {
  if (profundidad > 10) throw new Error('include() anidado demasiadas veces');
  const archivo = path.join(APPS, nombre + '.html');
  if (!fs.existsSync(archivo)) throw new Error(`include('${nombre}'): no existe apps-script/${nombre}.html`);
  return fs.readFileSync(archivo, 'utf8')
    .replace(/<\?!=\s*include\(\s*['"]([^'"]+)['"]\s*\)\s*;?\s*\?>/g, (_, n) => renderizar(n, profundidad + 1));
}

fs.mkdirSync(SALIDA, { recursive: true });
for (const [pagina, archivo] of [['Index', 'index.html'], ['Componentes', 'componentes.html']]) {
  const html = renderizar(pagina);
  if (/<\?/.test(html)) throw new Error(`${pagina}: quedó una marca de plantilla sin resolver`);
  fs.writeFileSync(path.join(SALIDA, archivo), html);
  console.log(`${archivo.padEnd(18)} ${(html.length / 1024).toFixed(0)} KB`);
}

// Modelos 3D: los mismos que SeccionCuerpo y SeccionMision piden con BASE_MODELOS
// Los .glb adelgazados se generan con astra-fit/publicar/herramientas/dividir-glb.js (solo músculos). astronaut.glb lo usa Destinos.
const MODELOS = ['Xbot-animaciones.glb', 'astronaut.glb', 'anatomy-male-musculos.glb', 'anatomy-female-musculos.glb'];
const ESCENARIOS = ['iss.glb', 'capsula.glb', 'lem.glb', 'rover.glb', 'hab1.glb', 'hab2.glb', 'gateway.png'];
let copiados = 0;
function copiar(rel) {
  const de = path.join(NASA, 'assets', rel), a = path.join(SALIDA, 'assets', rel);
  if (!fs.existsSync(de)) throw new Error('Falta el modelo assets/' + rel);
  fs.mkdirSync(path.dirname(a), { recursive: true });
  if (fs.existsSync(a) && fs.statSync(a).size === fs.statSync(de).size) return;
  fs.copyFileSync(de, a); copiados++;
}
MODELOS.forEach(copiar);
// Imágenes de anatomía de frente y de espalda (se generan con el modelo 3D; ver docs/equipo/NOTAS.md)
fs.readdirSync(path.join(NASA, 'assets', 'anatomia2d')).forEach((f) => copiar('anatomia2d/' + f));
ESCENARIOS.forEach((f) => copiar('escenarios/' + f));
console.log(`archivos: ${MODELOS.length + ESCENARIOS.length} modelos y las imágenes de anatomía en assets/ (${copiados} copiados ahora)`);
