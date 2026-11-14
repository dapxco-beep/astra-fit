/**
 * Code.gs — Servidor de ASTRA-FIT en Apps Script.
 *
 * Responsable: equipo de datos/backend.
 * El servidor local (local/server.js) imita estas mismas funciones con los
 * mismos nombres, para que el HTML funcione igual en local y en Google.
 *
 * Funciones que llama el HTML (vía JsApi.html):
 *   obtenerDatos()                  → todas las pestañas como { Pestaña: [ {col: valor}, ... ] }
 *   guardarAstronauta(astronauta)   → agrega una fila a Astronautas con el siguiente id AST-###
 *   guardarSeguimiento(registro)    → agrega una fila a Seguimiento
 *   guardarSesion(sesion, emg)      → agrega 1 fila a Sesiones y varias a EMG
 *   actualizarAlerta(id, cambios)   → cambia estado / nota de una alerta
 */

const PESTANAS = ['Astronautas', 'Catalogos', 'Sesiones', 'EMG', 'Seguimiento', 'Umbrales', 'Alertas', 'Intervenciones'];

/* ------------------------------------------------------------------ Página */
// Páginas disponibles: la principal y la guía de componentes (?page=componentes).
const PAGINAS = { componentes: 'Componentes' };

function doGet(e) {
  const pagina = PAGINAS[(e && e.parameter && e.parameter.page) || ''] || 'Index';
  return HtmlService.createTemplateFromFile(pagina)
    .evaluate()
    .setTitle('ASTRA-FIT')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Inserta el contenido de otro archivo .html (Estilos, JsApi...).
 *  Se evalúa como plantilla para que un archivo incluido pueda incluir otro (SeccionAcceso → Logo). */
function include(nombre) {
  return HtmlService.createTemplateFromFile(nombre).evaluate().getContent();
}

/* ------------------------------------------------------------------ Lectura */
function obtenerDatos() {
  const libro = SpreadsheetApp.getActive();
  const salida = {};
  PESTANAS.forEach(function (nombre) {
    const hoja = libro.getSheetByName(nombre);
    salida[nombre] = hoja ? leerHoja_(hoja) : [];
  });
  return salida;
}

/** Convierte una hoja en una lista de objetos usando la fila 1 como nombres. */
function leerHoja_(hoja) {
  const valores = hoja.getDataRange().getValues();
  if (valores.length < 2) return [];
  const cabecera = valores[0].map(String);
  const zona = Session.getScriptTimeZone();
  return valores.slice(1)
    .filter(function (fila) { return fila.some(function (c) { return c !== ''; }); })
    .map(function (fila) {
      const obj = {};
      cabecera.forEach(function (col, i) {
        let v = fila[i];
        // google.script.run no puede devolver fechas: se pasan a texto
        if (v instanceof Date) v = Utilities.formatDate(v, zona, col === 'registrado_en' || col === 'creada_en' ? 'yyyy-MM-dd HH:mm' : 'yyyy-MM-dd');
        obj[col] = v === '' ? null : v;
      });
      return obj;
    });
}

/* ------------------------------------------------------------------ Escritura */
function guardarAstronauta(astronauta) {
  return conBloqueo_(function () {
    const hoja = SpreadsheetApp.getActive().getSheetByName('Astronautas');
    const existentes = leerHoja_(hoja);
    const mayor = existentes.reduce(function (m, a) { return Math.max(m, parseInt(String(a.id_astronauta).replace(/\D/g, ''), 10) || 0); }, 0);
    astronauta.id_astronauta = 'AST-' + ('00' + (mayor + 1)).slice(-3);
    astronauta.activo = astronauta.activo || 'SI';
    agregarFila_('Astronautas', astronauta);
    return { ok: true, astronauta: astronauta };
  });
}

function guardarSeguimiento(registro) {
  return conBloqueo_(function () {
    registro.registrado_en = ahora_();
    agregarFila_('Seguimiento', registro);
    return { ok: true, registro: registro };
  });
}

function guardarSesion(sesion, filasEmg) {
  return conBloqueo_(function () {
    sesion.registrado_en = ahora_();
    agregarFila_('Sesiones', sesion);
    (filasEmg || []).forEach(function (f) { agregarFila_('EMG', f); });
    return { ok: true, sesion: sesion };
  });
}

/** Guarda alertas nuevas (las calcula JsAlertas.html en el navegador) y les pone el siguiente id ALR-####. */
function guardarAlertas(lista) {
  return conBloqueo_(function () {
    const hoja = SpreadsheetApp.getActive().getSheetByName('Alertas');
    let mayor = leerHoja_(hoja).reduce(function (m, a) { return Math.max(m, parseInt(String(a.id_alerta).replace(/\D/g, ''), 10) || 0); }, 0);
    const guardadas = (lista || []).map(function (a) {
      mayor += 1;
      a.id_alerta = 'ALR-' + ('000' + mayor).slice(-4);
      agregarFila_('Alertas', a);
      return a;
    });
    return { ok: true, alertas: guardadas };
  });
}

function actualizarAlerta(idAlerta, cambios) {
  return conBloqueo_(function () {
    const hoja = SpreadsheetApp.getActive().getSheetByName('Alertas');
    const valores = hoja.getDataRange().getValues();
    const cab = valores[0];
    const colId = cab.indexOf('id_alerta');
    for (let i = 1; i < valores.length; i++) {
      if (valores[i][colId] === idAlerta) {
        Object.keys(cambios).forEach(function (k) {
          const c = cab.indexOf(k);
          if (c >= 0) hoja.getRange(i + 1, c + 1).setValue(cambios[k]);
        });
        return { ok: true };
      }
    }
    throw new Error('No existe la alerta ' + idAlerta);
  });
}

/* ------------------------------------------------------------------ Utilidades */
/** Escribe una fila ubicando cada valor por el NOMBRE de la columna. */
function agregarFila_(nombreHoja, obj) {
  const hoja = SpreadsheetApp.getActive().getSheetByName(nombreHoja);
  if (!hoja) throw new Error('No existe la pestaña ' + nombreHoja);
  const cab = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  hoja.appendRow(cab.map(function (col) { return obj[col] === undefined || obj[col] === null ? '' : obj[col]; }));
}

/** Evita que dos personas escriban a la vez. */
function conBloqueo_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function ahora_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
}
