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
    const existentes = new Set((bd[hoja] || []).map(clave));
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
    const bd = await leerBD(env), t = ahora();
    astronauta.id_astronauta = 'AST-' + String(mayorNumero(bd.Astronautas, 'id_astronauta') + 1).padStart(3, '0');
    astronauta.activo = astronauta.activo || 'SI';
    Object.assign(astronauta, { registrado_en: t, actualizado_en: t, peso_actualizado_en: t, talla_actualizada_en: t });
    bd.Astronautas.push(astronauta);
    await escribirBD(env, bd);
    return { ok: true, astronauta };
  },

  async actualizarAstronauta(env, idAstronauta, cambios) {
    objeto(cambios, 'los cambios');
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
    let mayor = mayorNumero(bd.Alertas, 'id_alerta');
    const guardadas = lista.map((a) => { mayor += 1; a.id_alerta = 'ALR-' + String(mayor).padStart(4, '0'); bd.Alertas.push(objeto(a, 'la alerta')); return a; });
    await escribirBD(env, bd);
    return { ok: true, alertas: guardadas };
  },

  async guardarSeguimiento(env, registro) {
    objeto(registro, 'el registro');
    const bd = await leerBD(env);
    registro.registrado_en = ahora();
    bd.Seguimiento.push(registro);
    await escribirBD(env, bd);
    return { ok: true, registro };
  },

  async guardarEvaluaciones(env, filas) {
    if (!Array.isArray(filas) || filas.length > MAX_FILAS) throw new Error('Filas de evaluación no válidas');
    filas.forEach((f) => { objeto(f, 'la evaluación'); if (!f.id_evaluacion) throw new Error('Falta id_evaluacion'); });
    const bd = await leerBD(env), t = ahora();
    const guardadas = filas.map((f) => guardarOActualizar(bd, 'Evaluaciones', 'id_evaluacion', { ...f, actualizado_en: t }, t));
    await escribirBD(env, bd);
    return { ok: true, evaluaciones: guardadas };
  },

  async guardarMedicion(env, medicion, evaluacion) {
    objeto(medicion, 'la medición'); objeto(evaluacion, 'la evaluación');
    if (!evaluacion.id_evaluacion) throw new Error('Falta id_evaluacion');
    const bd = await leerBD(env), t = ahora();
    medicion.registrado_en = t;
    (bd.Monitoreo = bd.Monitoreo || []).push(medicion);
    const fila = guardarOActualizar(bd, 'Evaluaciones', 'id_evaluacion', { ...evaluacion, actualizado_en: t }, t);
    await escribirBD(env, bd);
    return { ok: true, medicion, evaluacion: fila };
  },

  async actualizarAlerta(env, idAlerta, cambios) {
    objeto(cambios, 'los cambios');
    const bd = await leerBD(env), alerta = bd.Alertas.find((a) => a.id_alerta === idAlerta);
    if (!alerta) throw new Error('No existe la alerta ' + idAlerta);
    Object.assign(alerta, cambios);
    await escribirBD(env, bd);
    return { ok: true };
  }
};

const JSON_UTF8 = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
const responder = (cuerpo, estado = 200) => new Response(JSON.stringify(cuerpo), { status: estado, headers: JSON_UTF8 });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);       // por si algún día se llama sin run_worker_first
    if (request.method !== 'POST') return responder({ error: 'Usa POST' }, 405);

    const nombre = decodeURIComponent(url.pathname.slice(5));
    if (!Object.prototype.hasOwnProperty.call(funciones, nombre)) return responder({ error: 'Función no encontrada: ' + nombre }, 404);

    try {
      const texto = await request.text();
      if (texto.length > MAX_CUERPO) return responder({ error: 'La petición es demasiado grande' }, 413);
      const args = texto ? JSON.parse(texto) : [];
      if (!Array.isArray(args)) return responder({ error: 'El cuerpo debe ser una lista de argumentos' }, 400);
      return responder(await funciones[nombre](env, ...args));
    } catch (e) {
      return responder({ error: e.message }, 500);
    }
  }
};
