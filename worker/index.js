/**
 * worker/index.js — Servidor de ASTRA-FIT en Cloudflare.
 *
 * Hace lo mismo que astra-fit/local/server.js (y que Code.gs en Apps Script), con los mismos nombres de función,
 * para que el HTML funcione igual en los tres lados. Los datos viven en Cloudflare KV, en un solo documento
 * (igual que local/datos-local.json). La primera vez se llena con astra-fit/local/datos-ejemplo.json.
 *
 *   POST /api/<función>   cuerpo: lista de argumentos en JSON   →   JSON con el resultado
 *   todo lo demás         lo sirve la carpeta publicar-cloudflare/ (página, modelos 3D)
 *
 * Límites a tener en cuenta (es una demo):
 *   - Cualquiera con el link puede leer y escribir. No hay inicio de sesión.
 *   - KV es de consistencia eventual y el documento se reescribe completo: si dos personas guardan en el mismo
 *     segundo, una escritura puede pisar a la otra.
 */
import SEMILLA from '../astra-fit/local/datos-ejemplo.json';

const CLAVE = 'bd';
const MAX_CUERPO = 1_000_000;   // 1 MB por petición
const MAX_ALERTAS = 100;
const MAX_FILAS = 50;           // filas de Evaluaciones por petición (6 músculos por evaluación)
const MAX_SENALES = 20_000;     // señales guardadas de una medición (texto JSON, ~7 KB)

// Versión de la estructura de datos. Al cambiarla, el documento guardado en KV se migra una sola vez (ver migrar()).
//   erdm-a-1 (14-nov): la escala ERDM-A con 6 músculos reemplaza Sesiones y EMG. Pestañas nuevas: Evaluaciones
//   (basal y seguimiento por músculo), Monitoreo (mediciones del sensor), EscalaERDM y PlanFortalecimiento.
const VERSION = 'erdm-a-1';
// Configuración del equipo (no datos de la gente): siempre igual a la semilla
const CONFIGURACION = ['Umbrales', 'Catalogos', 'EscalaERDM', 'PlanFortalecimiento'];

/** Pone al día un documento guardado con otra estructura. Conserva Astronautas y Seguimiento (lo que registró la gente);
 *  las evaluaciones, mediciones, alertas e intervenciones de ejemplo se reemplazan porque usaban los 5 grupos viejos. */
function migrar(bd) {
  let cambio = false;
  if (bd._version !== VERSION) {
    ['Evaluaciones', 'Monitoreo', 'Alertas', 'Intervenciones'].forEach((t) => { bd[t] = structuredClone(SEMILLA[t] || []); });
    delete bd.Sesiones; delete bd.EMG;
    bd._version = VERSION; cambio = true;
  }
  CONFIGURACION.forEach((t) => {
    if (JSON.stringify(bd[t]) !== JSON.stringify(SEMILLA[t])) { bd[t] = structuredClone(SEMILLA[t]); cambio = true; }
  });
  // Lo que la semilla trae de nuevo (evaluaciones y mediciones de ejemplo) se agrega solo si falta, sin pisar lo guardado
  const CLAVES = { Evaluaciones: (f) => f.id_evaluacion, Monitoreo: (f) => f.id_medicion };
  for (const [hoja, clave] of Object.entries(CLAVES)) {
    const existentes = new Set([...(bd[hoja] || []).map(clave), ...((bd._eliminados || {})[hoja] || [])]);   // lo borrado a propósito no vuelve
    const faltan = (SEMILLA[hoja] || []).filter((f) => !existentes.has(clave(f)));
    if (faltan.length) { bd[hoja] = [...(bd[hoja] || []), ...structuredClone(faltan)]; cambio = true; }
  }
  return cambio;
}

async function leerBD(env) {
  const guardado = await env.ASTRA_FIT.get(CLAVE);
  if (guardado) {
    const bd = JSON.parse(guardado);
    if (migrar(bd)) await env.ASTRA_FIT.put(CLAVE, JSON.stringify(bd));
    return bd;
  }
  const bd = structuredClone(SEMILLA);
  bd._version = VERSION;
  await env.ASTRA_FIT.put(CLAVE, JSON.stringify(bd));
  return bd;
}
const escribirBD = (env, bd) => env.ASTRA_FIT.put(CLAVE, JSON.stringify(bd));

/** Fecha y hora de Bogotá como "2026-11-14 09:05" (igual que ahora_() en Code.gs). */
function ahora() {
  const p = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
  return p.replace('T', ' ');
}
const mayorNumero = (filas, campo) => Math.max(0, ...filas.map((f) => parseInt(String(f[campo]).replace(/\D/g, ''), 10) || 0));
/* ---- Validación (demo pública: cualquiera con el enlace puede escribir, así que se limita qué y cuánto) ---- */
const CAMPOS_PERFIL = { nombre: 60, rol: 60, entorno: 20, fecha_inicio_mision: 10, sexo: 1, mano_dominante: 10, avatar: 40, emoji: 30, activo: 2, escenario: 20 };
const RANGOS_PERFIL = { edad: [21, 70], peso_kg: [40, 150], talla_cm: [140, 210] };   // los mismos del formulario de perfil
const ESTADOS_ALERTA = ['abierta', 'en_seguimiento', 'atendida'];
const TOPES = { Astronautas: 50, Seguimiento: 3000, Alertas: 1500, Evaluaciones: 3000, Monitoreo: 3000, Intervenciones: 500 };
function limpiarPerfil(obj) {
  const salida = {};
  for (const [k, max] of Object.entries(CAMPOS_PERFIL)) if (obj[k] !== undefined && obj[k] !== null) salida[k] = String(obj[k]).slice(0, max);
  for (const [k, [min, max]] of Object.entries(RANGOS_PERFIL)) {
    if (obj[k] === undefined) continue;
    const n = Number(obj[k]);
    if (!(n >= min && n <= max)) throw new Error(k + ' debe estar entre ' + min + ' y ' + max);
    salida[k] = n;
  }
  return salida;
}
function hayEspacio(bd, tabla) { if ((bd[tabla] || []).length >= TOPES[tabla]) throw new Error('La demostración está llena (' + tabla + '). Avisa al equipo.'); }
const objeto = (v, nombre) => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Falta ' + nombre); return v; };

/* Igual que guardarOActualizar_ de Code.gs: si la fila existe cambia los campos enviados, si no la agrega */
function guardarOActualizar(bd, tabla, clave, obj, t) {
  const filas = (bd[tabla] = bd[tabla] || []);
  const fila = filas.find((f) => String(f[clave]) === String(obj[clave]));
  if (!fila) { const nueva = { ...obj, registrado_en: obj.registrado_en || t }; filas.push(nueva); return nueva; }
  Object.keys(obj).forEach((k) => { if (k !== 'registrado_en' && obj[k] !== undefined) fila[k] = obj[k]; });
  return fila;
}

/* Mismas funciones y mismos nombres que Code.gs y local/server.js */
const funciones = {
  async obtenerDatos(env) { return leerBD(env); },

  async guardarAstronauta(env, astronauta) {
    objeto(astronauta, 'el astronauta');
    astronauta = limpiarPerfil(astronauta);
    if (!astronauta.nombre) throw new Error('Falta el nombre');
    const bd = await leerBD(env), t = ahora();
    hayEspacio(bd, 'Astronautas');
    astronauta.id_astronauta = 'AST-' + String(mayorNumero(bd.Astronautas, 'id_astronauta') + 1).padStart(3, '0');
    astronauta.activo = astronauta.activo || 'SI';
    Object.assign(astronauta, { registrado_en: t, actualizado_en: t, peso_actualizado_en: t, talla_actualizada_en: t });
    bd.Astronautas.push(astronauta);
    await escribirBD(env, bd);
    return { ok: true, astronauta };
  },

  async actualizarAstronauta(env, idAstronauta, cambios) {
    objeto(cambios, 'los cambios');
    cambios = limpiarPerfil(cambios);
    const bd = await leerBD(env), a = bd.Astronautas.find((x) => x.id_astronauta === idAstronauta);
    if (!a) throw new Error('No existe el astronauta ' + idAstronauta);
    const t = ahora();
    if ('peso_kg' in cambios && Number(cambios.peso_kg) !== Number(a.peso_kg)) cambios.peso_actualizado_en = t;
    if ('talla_cm' in cambios && Number(cambios.talla_cm) !== Number(a.talla_cm)) cambios.talla_actualizada_en = t;
    delete cambios.id_astronauta;
    Object.assign(a, cambios, { actualizado_en: t });
    await escribirBD(env, bd);
    return { ok: true, astronauta: a };
  },

  async guardarAlertas(env, lista) {
    if (!Array.isArray(lista) || lista.length > MAX_ALERTAS) throw new Error('Lista de alertas no válida');
    const bd = await leerBD(env);
    if (bd.Alertas.length + lista.length > TOPES.Alertas) throw new Error('La demostración está llena (Alertas). Avisa al equipo.');
    let mayor = mayorNumero(bd.Alertas, 'id_alerta');
    const guardadas = lista.map((a) => { mayor += 1; a.id_alerta = 'ALR-' + String(mayor).padStart(4, '0'); bd.Alertas.push(objeto(a, 'la alerta')); return a; });
    await escribirBD(env, bd);
    return { ok: true, alertas: guardadas };
  },

  async guardarSeguimiento(env, registro) {
    objeto(registro, 'el registro');
    const bd = await leerBD(env);
    hayEspacio(bd, 'Seguimiento');
    registro.registrado_en = ahora();
    bd.Seguimiento.push(registro);
    await escribirBD(env, bd);
    return { ok: true, registro };
  },

  async guardarEvaluaciones(env, filas) {
    if (!Array.isArray(filas) || filas.length > MAX_FILAS) throw new Error('Filas de evaluación no válidas');
    filas.forEach((f) => { objeto(f, 'la evaluación'); if (!f.id_evaluacion) throw new Error('Falta id_evaluacion'); });
    const bd = await leerBD(env), t = ahora();
    hayEspacio(bd, 'Evaluaciones');
    const guardadas = filas.map((f) => guardarOActualizar(bd, 'Evaluaciones', 'id_evaluacion', { ...f, actualizado_en: t }, t));
    await escribirBD(env, bd);
    return { ok: true, evaluaciones: guardadas };
  },

  async guardarMedicion(env, medicion, evaluacion) {
    objeto(medicion, 'la medición');
    if (medicion.senales !== undefined && String(medicion.senales).length > MAX_SENALES) throw new Error('Las señales de la medición son demasiado grandes');
    const lista = Array.isArray(evaluacion) ? evaluacion : [objeto(evaluacion, 'la evaluación')];   // VO2pico manda las 6 filas
    if (!lista.length || lista.length > MAX_FILAS) throw new Error('Filas de evaluación no válidas');
    lista.forEach((e) => { objeto(e, 'la evaluación'); if (!e.id_evaluacion) throw new Error('Falta id_evaluacion'); });
    const bd = await leerBD(env), t = ahora();
    hayEspacio(bd, 'Monitoreo');
    medicion.registrado_en = t;
    (bd.Monitoreo = bd.Monitoreo || []).push(medicion);
    const filas = lista.map((e) => guardarOActualizar(bd, 'Evaluaciones', 'id_evaluacion', { ...e, actualizado_en: t }, t));
    await escribirBD(env, bd);
    return { ok: true, medicion, evaluacion: filas[0], evaluaciones: filas };
  },

  /* Borra una medición mal tomada. Lo que se borra queda anotado en bd._eliminados para que migrar() no lo vuelva
     a traer de la semilla. */
  async eliminarMedicion(env, idMedicion, cambios) {
    if (!idMedicion || typeof idMedicion !== 'string') throw new Error('Falta la medición');
    cambios = cambios && typeof cambios === 'object' ? cambios : {};
    const evaluaciones = Array.isArray(cambios.evaluaciones) ? cambios.evaluaciones : [];
    const borrarE = Array.isArray(cambios.borrarEvaluaciones) ? cambios.borrarEvaluaciones.map(String) : [];
    const borrarA = Array.isArray(cambios.borrarAlertas) ? cambios.borrarAlertas.map(String) : [];
    if (evaluaciones.length > MAX_FILAS || borrarE.length > MAX_FILAS || borrarA.length > MAX_ALERTAS) throw new Error('Demasiados cambios');
    evaluaciones.forEach((e) => { objeto(e, 'la evaluación'); if (!e.id_evaluacion) throw new Error('Falta id_evaluacion'); });
    const bd = await leerBD(env), t = ahora();
    if (!(bd.Monitoreo || []).some((m) => m.id_medicion === idMedicion)) throw new Error('No existe la medición ' + idMedicion);
    bd.Monitoreo = bd.Monitoreo.filter((m) => m.id_medicion !== idMedicion);
    const guardadas = evaluaciones.map((e) => guardarOActualizar(bd, 'Evaluaciones', 'id_evaluacion', { ...e, actualizado_en: t }, t));
    bd.Evaluaciones = bd.Evaluaciones.filter((e) => !borrarE.includes(String(e.id_evaluacion)));
    bd.Alertas = bd.Alertas.filter((a) => !borrarA.includes(String(a.id_alerta)));
    const el = (bd._eliminados = bd._eliminados || { Monitoreo: [], Evaluaciones: [] });
    el.Monitoreo.push(idMedicion); el.Evaluaciones.push(...borrarE);
    await escribirBD(env, bd);
    return { ok: true, evaluaciones: guardadas };
  },

  async actualizarAlerta(env, idAlerta, cambios) {
    objeto(cambios, 'los cambios');
    const bd = await leerBD(env), alerta = bd.Alertas.find((a) => a.id_alerta === idAlerta);
    if (!alerta) throw new Error('No existe la alerta ' + idAlerta);
    // Solo se puede cambiar el estado y quién la atendió y por qué
    if ('estado' in cambios) { if (!ESTADOS_ALERTA.includes(cambios.estado)) throw new Error('Estado de alerta no válido'); alerta.estado = cambios.estado; }
    if ('atendida_por' in cambios) alerta.atendida_por = String(cambios.atendida_por || '').slice(0, 60);
    if ('nota_cierre' in cambios) alerta.nota_cierre = String(cambios.nota_cierre || '').slice(0, 300);
    await escribirBD(env, bd);
    return { ok: true, alerta };
  }
};

/* ---- Copia en Google Sheets (astra-fit/sheets-espejo/Espejo.gs) ----
 * Después de cada guardado se mandan al Sheet las filas que cambiaron. Va por ctx.waitUntil, así que la página no
 * espera a Google, y si el envío falla no pasa nada: el Sheet se pone al día solo cada 5 minutos (traerTodo).
 * Se activa con dos secretos del Worker: SHEETS_URL (la URL /exec del Apps Script) y SHEETS_CLAVE. */
const ESPEJO = {
  guardarAstronauta: (r) => [{ tabla: 'Astronautas', filas: [r.astronauta] }],
  actualizarAstronauta: (r) => [{ tabla: 'Astronautas', filas: [r.astronauta] }],
  guardarAlertas: (r) => [{ tabla: 'Alertas', filas: r.alertas }],
  actualizarAlerta: (r) => [{ tabla: 'Alertas', filas: [r.alerta] }],
  guardarSeguimiento: (r) => [{ tabla: 'Seguimiento', filas: [r.registro] }],
  guardarEvaluaciones: (r) => [{ tabla: 'Evaluaciones', filas: r.evaluaciones }],
  guardarMedicion: (r) => [{ tabla: 'Monitoreo', filas: [r.medicion] }, { tabla: 'Evaluaciones', filas: r.evaluaciones || [r.evaluacion] }]
};

async function enviarAlSheet(env, cambios) {
  try {
    const r = await fetch(env.SHEETS_URL, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ clave: env.SHEETS_CLAVE, cambios })
    });
    const texto = await r.text();
    if (!r.ok || texto.includes('"error"')) console.error('Sheet: ' + r.status + ' ' + texto.slice(0, 200));
  } catch (e) {
    console.error('Sheet: ' + e.message);
  }
}

const JSON_UTF8 = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const responder = (cuerpo, estado = 200) => new Response(JSON.stringify(cuerpo), { status: estado, headers: JSON_UTF8 });

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);       // por si algún día se llama sin run_worker_first
    if (request.method !== 'POST') return responder({ error: 'Usa POST' }, 405);

    // Solo se aceptan peticiones de la propia página: JSON y, si el navegador manda Origin, del mismo origen
    if (!(request.headers.get('Content-Type') || '').toLowerCase().startsWith('application/json')) return responder({ error: 'Se esperaba application/json' }, 415);
    const origen = request.headers.get('Origin');
    if (origen && origen !== url.origin) return responder({ error: 'Origen no permitido' }, 403);

    const nombre = decodeURIComponent(url.pathname.slice(5));
    if (!Object.prototype.hasOwnProperty.call(funciones, nombre)) return responder({ error: 'Función no encontrada: ' + nombre }, 404);

    try {
      const texto = await request.text();
      if (texto.length > MAX_CUERPO) return responder({ error: 'La petición es demasiado grande' }, 413);
      const args = texto ? JSON.parse(texto) : [];
      if (!Array.isArray(args)) return responder({ error: 'El cuerpo debe ser una lista de argumentos' }, 400);
      const resultado = await funciones[nombre](env, ...args);
      if (ESPEJO[nombre] && env.SHEETS_URL && env.SHEETS_CLAVE) ctx.waitUntil(enviarAlSheet(env, ESPEJO[nombre](resultado)));
      return responder(resultado);
    } catch (e) {
      return responder({ error: e.message }, 500);
    }
  }
};
