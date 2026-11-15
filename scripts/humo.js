/**
 * humo.js — Prueba de humo de ASTRA-FIT con Playwright y el Chrome instalado. Solo lectura: no guarda nada.
 *
 *   node scripts/humo.js                 (contra http://localhost:3000)
 *   node scripts/humo.js https://astra-fit-modelos.dapxco.workers.dev/
 *
 * Revisa, en escritorio y en celular: que carga la tripulación, que no hay errores de JavaScript, que la API responde,
 * y que se llega a CADA vista con clics reales (en el celular, incluido el menú "Más").
 * Sale con código 1 si algo falla.
 */
const { chromium } = require('playwright-core');
const URL = (process.argv[2] || process.env.BASE_URL || 'http://localhost:3000').replace(/\/?$/, '/');
const VISTAS = ['hoy', 'monitoreo', 'cuerpo', 'alertas', 'sensores', 'evolucion', 'mision', 'inicio'];
const PRINCIPALES = ['hoy', 'monitoreo', 'cuerpo', 'alertas'];
const fallos = [];
const falla = (m) => { fallos.push(m); console.log('  FALLA: ' + m); };
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

async function recorrer(browser, nombre, viewport, movil) {
  console.log('== ' + nombre);
  const ctx = await browser.newContext({ viewport, isMobile: movil, hasTouch: movil });
  const p = await ctx.newPage(); const errores = [];
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 140)));
  await p.goto(URL, { waitUntil: 'load', timeout: 60000 });
  await p.waitForSelector('.perfil[data-id]', { timeout: 30000 }).catch(() => falla('no aparece la tripulación'));
  await p.click('.perfil[data-id]').catch(() => falla('no se puede elegir un astronauta'));
  await p.waitForSelector('#vista-panel:not([hidden])', { timeout: 15000 }).catch(() => falla('no abre el tablero'));
  await pausa(1500);
  for (const v of VISTAS) {
    try {
      if (movil && !PRINCIPALES.includes(v)) await p.click('#tab-mas', { timeout: 5000 });
      const sel = (movil ? (PRINCIPALES.includes(v) ? '#nav-inferior ' : '#hoja-mas ') : '.barra-lateral ') + '[data-vista="' + v + '"]';
      await p.click(sel, { timeout: 5000 });
      await pausa(500);
      const visible = await p.evaluate((id) => { const el = document.getElementById(id === 'inicio' ? 'inicio-vista' : id); return !!el && !el.hidden; }, v);
      if (!visible) falla('la vista "' + v + '" no se muestra al pulsarla');
      else console.log('  ok ' + v);
    } catch (e) { falla('no se llega a la vista "' + v + '" con un clic (' + String(e).split('\n')[0].slice(0, 80) + ')'); }
  }
  if (errores.length) falla('errores de JavaScript: ' + errores.join(' | '));
  await ctx.close();
}

(async () => {
  console.log('Prueba de humo contra ' + URL);
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const api = await fetch(URL + 'api/obtenerDatos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '[]' }).then((r) => r.ok ? r.json() : null).catch(() => null);
  if (!api || !api.Astronautas || !api.Astronautas.length) falla('la API no devuelve astronautas'); else console.log('API ok: ' + Object.entries(api).filter(([, v]) => Array.isArray(v)).map(([k, v]) => k + ':' + v.length).join(' '));
  const sinTipo = await fetch(URL + 'api/obtenerDatos', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '[]' }).then((r) => r.status).catch(() => 0);
  if (sinTipo !== 415 && sinTipo !== 404 && sinTipo !== 200) console.log('  aviso: respuesta ' + sinTipo + ' a un POST sin application/json');
  await recorrer(browser, 'escritorio', { width: 1440, height: 900 }, false);
  await recorrer(browser, 'celular', { width: 390, height: 844 }, true);
  await browser.close();
  if (fallos.length) { console.log('\nFALLÓ la prueba de humo (' + fallos.length + ').'); process.exit(1); }
  console.log('\nPrueba de humo OK.');
})();
