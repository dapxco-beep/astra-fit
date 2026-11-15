/**
 * Espejo.gs — Copia en Google Sheets de lo que se guarda en la página de Cloudflare.
 *
 * Va en el Apps Script del Sheet "DATOS" (Extensiones → Apps Script). No es el Code.gs de apps-script/:
 * este no sirve la página, solo recibe los datos. La base principal sigue siendo Cloudflare KV.
 *
 * Cómo llegan los datos:
 *   1. Al instante: cada vez que alguien guarda algo en la página, el Worker (worker/index.js) llama a doPost con
 *      las filas que cambiaron. Una medición nueva aparece en Monitoreo y su fila de Evaluaciones se actualiza.
 *   2. Cada 5 minutos (y desde el menú ASTRA-FIT): traerTodo() lee la página completa y reescribe las pestañas.
 *      Así se recupera cualquier envío que haya fallado.
 *
 * Instalación: ver astra-fit/sheets-espejo/LEEME.md.
 */

// La misma clave que se guarda en Cloudflare con: npx wrangler secret put SHEETS_CLAVE
const CLAVE = 'PEGAR-AQUI-LA-CLAVE';
const PAGINA = 'https://astra-fit-modelos.dapxco.workers.dev';

const ORDEN = ['Monitoreo', 'Evaluaciones', 'Alertas', 'Astronautas', 'Seguimiento', 'Intervenciones',
               'EscalaERDM', 'PlanFortalecimiento', 'Umbrales', 'Catalogos'];
const CLAVES = { Astronautas: 'id_astronauta', Evaluaciones: 'id_evaluacion', Monitoreo: 'id_medicion',
                 Alertas: 'id_alerta', Intervenciones: 'id_intervencion' };   // Seguimiento no tiene id: solo se agrega
const EN_VIVO = 'En vivo';
const FILAS_EN_VIVO = 30;

/* ------------------------------------------------------------------ Lo que manda el Worker */
function doPost(e) {
  let datos;
  try { datos = JSON.parse(e.postData.contents); } catch (err) { return salida_({ error: 'JSON no válido' }); }
  if (!datos || datos.clave !== CLAVE || CLAVE === 'PEGAR-AQUI-LA-CLAVE') return salida_({ error: 'Clave incorrecta' });
  const cambios = Array.isArray(datos.cambios) ? datos.cambios : [];
  conBloqueo_(function () {
    cambios.forEach(function (c) {
      if (ORDEN.indexOf(c.tabla) < 0 || !Array.isArray(c.filas)) return;
      c.filas.forEach(function (fila) { guardarFila_(hoja_(c.tabla), CLAVES[c.tabla], fila); });
    });
    marcarActualizado_();
  });
  return salida_({ ok: true, cambios: cambios.length });
}

function doGet() { return salida_({ ok: true, servicio: 'Espejo ASTRA-FIT' }); }

/* ------------------------------------------------------------------ Traer todo desde la página */
function traerTodo() {
  const r = UrlFetchApp.fetch(PAGINA + '/api/obtenerDatos', {
    method: 'post', contentType: 'application/json', payload: '[]', muteHttpExceptions: true
  });
  if (r.getResponseCode() !== 200) throw new Error('La página respondió ' + r.getResponseCode() + ': ' + r.getContentText().slice(0, 200));
  const bd = JSON.parse(r.getContentText());
  conBloqueo_(function () {
    ORDEN.forEach(function (tabla) { if (Array.isArray(bd[tabla])) reescribir_(hoja_(tabla), bd[tabla]); });
    prepararEnVivo_();
    marcarActualizado_();
  });
}

/** Ejecutar una vez a mano: deja traerTodo() corriendo cada 5 minutos y llena el Sheet por primera vez. */
function activarSincronizacion() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'traerTodo') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('traerTodo').timeBased().everyMinutes(5).create();
  traerTodo();
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('ASTRA-FIT')
    .addItem('Traer todo de la página ahora', 'traerTodo')
    .addToUi();
}

/* ------------------------------------------------------------------ Escritura */
function hoja_(nombre) {
  const libro = SpreadsheetApp.getActive();
  let hoja = libro.getSheetByName(nombre);
  if (!hoja) {
    hoja = libro.insertSheet(nombre);
    const vacia = libro.getSheetByName('Hoja 1') || libro.getSheetByName('Sheet1');
    if (vacia && vacia.getLastRow() === 0 && libro.getSheets().length > 1) libro.deleteSheet(vacia);
  }
  return hoja;
}

/** Si la fila ya existe (misma clave) cambia sus valores; si no, la agrega al final. */
function guardarFila_(hoja, clave, obj) {
  const cab = asegurarColumnas_(hoja, Object.keys(obj));
  const fila = cab.map(function (c) { return valor_(obj[c]); });
  if (clave && obj[clave] !== undefined && hoja.getLastRow() > 1) {
    const col = cab.indexOf(clave) + 1;
    const ids = hoja.getRange(2, col, hoja.getLastRow() - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === String(obj[clave])) {
        const actual = hoja.getRange(i + 2, 1, 1, cab.length).getValues()[0];
        cab.forEach(function (c, j) { if (obj[c] !== undefined) actual[j] = fila[j]; });
        hoja.getRange(i + 2, 1, 1, cab.length).setValues([actual]);
        return;
      }
    }
  }
  hoja.getRange(hoja.getLastRow() + 1, 1, 1, cab.length).setValues([fila]);
}

/** Agrega al final de la fila 1 las columnas que falten y devuelve la cabecera completa. */
function asegurarColumnas_(hoja, columnas) {
  const cab = hoja.getLastColumn() ? hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0].map(String) : [];
  const faltan = columnas.filter(function (c) { return cab.indexOf(c) < 0; });
  if (faltan.length) {
    hoja.getRange(1, cab.length + 1, 1, faltan.length).setValues([faltan]);
    formatoCabecera_(hoja);
  }
  return cab.concat(faltan);
}

function reescribir_(hoja, filas) {
  const cab = [];
  filas.forEach(function (f) { Object.keys(f).forEach(function (k) { if (cab.indexOf(k) < 0) cab.push(k); }); });
  hoja.clearContents();
  if (!cab.length) return;
  const valores = [cab].concat(filas.map(function (f) { return cab.map(function (c) { return valor_(f[c]); }); }));
  hoja.getRange(1, 1, valores.length, cab.length).setValues(valores);
  formatoCabecera_(hoja);
}

function formatoCabecera_(hoja) {
  hoja.setFrozenRows(1);
  hoja.getRange(1, 1, 1, hoja.getLastColumn()).setFontWeight('bold').setBackground('#1d1d1f').setFontColor('#ffffff');
}

/** Pestaña "En vivo": las últimas mediciones del sensor, la más reciente arriba. Se arma con fórmulas sobre Monitoreo. */
function prepararEnVivo_() {
  const libro = SpreadsheetApp.getActive();
  if (libro.getSheetByName(EN_VIVO)) return;
  const hoja = libro.insertSheet(EN_VIVO, 0);
  hoja.getRange('A1').setValue('Últimas mediciones del sensor').setFontWeight('bold').setFontSize(14);
  hoja.getRange('A3').setFormula('=Monitoreo!A1:AZ1');
  hoja.getRange('A4').setFormula('=IFERROR(ARRAY_CONSTRAIN(SORT(FILTER(Monitoreo!A2:AZ, Monitoreo!A2:A<>""), ' +
    'MATCH("registrado_en", Monitoreo!A1:AZ1, 0), FALSE), ' + FILAS_EN_VIVO + ', 52), "Aún no hay mediciones")');
  hoja.getRange(3, 1, 1, 52).setFontWeight('bold').setBackground('#1d1d1f').setFontColor('#ffffff');
  hoja.setFrozenRows(3);
  libro.setActiveSheet(hoja);
}

function marcarActualizado_() {
  const hoja = SpreadsheetApp.getActive().getSheetByName(EN_VIVO);
  if (hoja) hoja.getRange('D1').setValue('Actualizado: ' + Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd HH:mm:ss'));
}

/* ------------------------------------------------------------------ Utilidades */
function valor_(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

function conBloqueo_(fn) {
  const bloqueo = LockService.getScriptLock();
  bloqueo.waitLock(30000);
  try { return fn(); } finally { bloqueo.releaseLock(); }
}

function salida_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
