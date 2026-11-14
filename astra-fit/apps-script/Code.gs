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
 *   actualizarAstronauta(id, cambios) → edita el perfil (registra la fecha de cambio de peso y talla)
 *   guardarSeguimiento(registro)    → agrega una fila a Seguimiento
 *   guardarEvaluaciones(filas)      → crea o actualiza filas de Evaluaciones (una por astronauta, fecha y músculo)
 *   guardarMedicion(medicion, eval) → agrega la medición del sensor a Monitoreo y actualiza su fila de Evaluaciones
 *   actualizarAlerta(id, cambios)   → cambia estado / nota de una alerta
 */

const PESTANAS = ['Astronautas', 'Catalogos', 'Evaluaciones', 'Monitoreo', 'EscalaERDM', 'PlanFortalecimiento',
                  'Seguimiento', 'Umbrales', 'Alertas', 'Intervenciones'];

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
  prepararBase_();
  const libro = SpreadsheetApp.getActive();
  const salida = {};
  PESTANAS.forEach(function (nombre) {
    const hoja = libro.getSheetByName(nombre);
    salida[nombre] = hoja ? leerHoja_(hoja) : [];
  });
  return salida;
}

/** Si al Sheet le faltan pestañas (por ejemplo, un Sheet nuevo y vacío), las crea con los datos de ejemplo
 *  de DatosEjemplo.gs. Las pestañas que ya existen no se tocan, así que no pisa datos reales. */
function prepararBase_() {
  const libro = SpreadsheetApp.getActive();
  if (PESTANAS.every(function (n) { return libro.getSheetByName(n); })) return;
  conBloqueo_(function () {
    libro.setSpreadsheetTimeZone(Session.getScriptTimeZone());   // las fechas de ejemplo se leen en esta zona
    PESTANAS.forEach(function (nombre) {
      if (libro.getSheetByName(nombre)) return;
      const filas = DATOS_EJEMPLO[nombre] || [];
      const hoja = libro.insertSheet(nombre);
      if (!filas.length) return;
      const cab = [];
      filas.forEach(function (f) { Object.keys(f).forEach(function (k) { if (cab.indexOf(k) < 0) cab.push(k); }); });
      const matriz = [cab].concat(filas.map(function (f) { return cab.map(function (c) { return f[c] === null || f[c] === undefined ? '' : f[c]; }); }));
      hoja.getRange(1, 1, matriz.length, cab.length).setValues(matriz);
      hoja.setFrozenRows(1);
    });
    ['Hoja 1', 'Sheet1'].forEach(function (n) {
      const vacia = libro.getSheetByName(n);
      if (vacia && libro.getSheets().length > 1) libro.deleteSheet(vacia);
    });
  });
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
        if (v instanceof Date) v = Utilities.formatDate(v, zona, col === 'hora' ? 'HH:mm' : /_en$/.test(col) ? 'yyyy-MM-dd HH:mm' : 'yyyy-MM-dd');  // hora = solo hora; *_en = fecha y hora
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
    const ahora = ahora_();
    astronauta.id_astronauta = 'AST-' + ('00' + (mayor + 1)).slice(-3);
    astronauta.activo = astronauta.activo || 'SI';
    astronauta.registrado_en = ahora;
    astronauta.actualizado_en = ahora;
    astronauta.peso_actualizado_en = ahora;
    astronauta.talla_actualizada_en = ahora;
    agregarFila_('Astronautas', astronauta);
    return { ok: true, astronauta: astronauta };
  });
}

/** Cambia solo los campos enviados. Registra cuándo se actualizó el perfil, el peso y la talla. */
function actualizarAstronauta(idAstronauta, cambios) {
  return conBloqueo_(function () {
    const hoja = SpreadsheetApp.getActive().getSheetByName('Astronautas');
    const ahora = ahora_();
    asegurarColumnas_(hoja, Object.keys(cambios).concat(['actualizado_en', 'peso_actualizado_en', 'talla_actualizada_en']));
    const valores = hoja.getDataRange().getValues();
    const cab = valores[0];
    const fila = valores.findIndex(function (f, i) { return i > 0 && f[cab.indexOf('id_astronauta')] === idAstronauta; });
    if (fila < 1) throw new Error('No existe el astronauta ' + idAstronauta);
    const actual = {};
    cab.forEach(function (c, j) { actual[c] = valores[fila][j]; });
    if ('peso_kg' in cambios && Number(cambios.peso_kg) !== Number(actual.peso_kg)) cambios.peso_actualizado_en = ahora;
    if ('talla_cm' in cambios && Number(cambios.talla_cm) !== Number(actual.talla_cm)) cambios.talla_actualizada_en = ahora;
    cambios.actualizado_en = ahora;
    delete cambios.id_astronauta;
    Object.keys(cambios).forEach(function (k) {
      const c = cab.indexOf(k);
      if (c >= 0) hoja.getRange(fila + 1, c + 1).setValue(cambios[k]);
    });
    const resultado = leerHoja_(hoja).find(function (a) { return a.id_astronauta === idAstronauta; });
    return { ok: true, astronauta: resultado };
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

function guardarSeguimiento(registro) {
  return conBloqueo_(function () {
    registro.registrado_en = ahora_();
    agregarFila_('Seguimiento', registro);
    return { ok: true, registro: registro };
  });
}

/** Crea o actualiza filas de Evaluaciones. La clave es id_evaluacion (EVA-AST001-20261114-cuadriceps). */
function guardarEvaluaciones(filas) {
  return conBloqueo_(function () {
    const ahora = ahora_();
    const guardadas = (filas || []).map(function (f) {
      f.actualizado_en = ahora;
      return guardarOActualizar_('Evaluaciones', 'id_evaluacion', f, ahora);
    });
    return { ok: true, evaluaciones: guardadas };
  });
}

/** Una medición del sensor: va a Monitoreo y sus resultados (EMG y coordinación) a la fila del día en Evaluaciones. */
function guardarMedicion(medicion, evaluacion) {
  return conBloqueo_(function () {
    const ahora = ahora_();
    medicion.registrado_en = ahora;
    agregarFila_('Monitoreo', medicion);
    evaluacion.actualizado_en = ahora;
    const fila = guardarOActualizar_('Evaluaciones', 'id_evaluacion', evaluacion, ahora);
    return { ok: true, medicion: medicion, evaluacion: fila };
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
  asegurarColumnas_(hoja, Object.keys(obj));
  const cab = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
  hoja.appendRow(cab.map(function (col) { return obj[col] === undefined || obj[col] === null ? '' : obj[col]; }));
}

/** Si llega un campo que la hoja aún no tiene (ej. emoji), agrega la columna al final de la fila 1. */
/** Busca la fila cuya columna `clave` vale obj[clave]: si existe cambia solo los campos enviados; si no, la agrega. */
function guardarOActualizar_(nombreHoja, clave, obj, ahora) {
  const hoja = SpreadsheetApp.getActive().getSheetByName(nombreHoja);
  if (!hoja) throw new Error('No existe la pestaña ' + nombreHoja);
  asegurarColumnas_(hoja, Object.keys(obj).concat(['registrado_en']));
  const valores = hoja.getDataRange().getValues();
  const cab = valores[0].map(String);
  const col = cab.indexOf(clave);
  const i = valores.findIndex(function (f, n) { return n > 0 && String(f[col]) === String(obj[clave]); });
  if (i < 1) {
    obj.registrado_en = obj.registrado_en || ahora;
    hoja.appendRow(cab.map(function (c) { return obj[c] === undefined || obj[c] === null ? '' : obj[c]; }));
    return obj;
  }
  const fila = valores[i].slice();
  Object.keys(obj).forEach(function (k) {
    const c = cab.indexOf(k);
    if (c >= 0 && k !== 'registrado_en' && obj[k] !== undefined) fila[c] = obj[k] === null ? '' : obj[k];
  });
  hoja.getRange(i + 1, 1, 1, fila.length).setValues([fila]);
  const salida = {};
  cab.forEach(function (c, j) { salida[c] = fila[j] === '' ? null : fila[j]; });
  return salida;
}

/** Si llega un campo que la hoja aún no tiene (ej. emoji), agrega la columna al final de la fila 1. */
function asegurarColumnas_(hoja, claves) {
  const ultima = Math.max(hoja.getLastColumn(), 1);
  const cab = hoja.getRange(1, 1, 1, ultima).getValues()[0].map(String);
  const faltan = claves.filter(function (k) { return cab.indexOf(k) < 0; });
  if (faltan.length) hoja.getRange(1, ultima + 1, 1, faltan.length).setValues([faltan]);
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
