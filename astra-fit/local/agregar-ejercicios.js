/**
 * agregar-ejercicios.js — Añade a los datos de ejemplo los ejercicios del documento ASTRA-FIT que faltaban:
 *   - Press de pecho (pectorales, tríceps, deltoides)
 *   - Carrera en cinta con arnés (resistencia, simetría de la marcha)
 * Los otros cuatro (sentadilla, peso muerto, remo sentado, elevación de talones) ya estaban.
 *
 *   node astra-fit/local/agregar-ejercicios.js
 *
 * Es idempotente: si los ejercicios ya están en datos-ejemplo.json, no hace nada.
 * Escribe: local/datos-ejemplo.json, apps-script/DatosEjemplo.gs y las hojas CSV de Catalogos, Sesiones, EMG y Alertas.
 * Las mismas reglas que generar_datos.py (escenarios, umbrales, escalado de alertas); los números salen de otra semilla.
 */
const fs = require('fs');
const path = require('path');

const AQUI = __dirname, RAIZ = path.join(AQUI, '..');
const JSON_RUTA = path.join(AQUI, 'datos-ejemplo.json');
const GS_RUTA = path.join(RAIZ, 'apps-script', 'DatosEjemplo.gs');
const CSV_DIR = path.join(RAIZ, 'publicar', 'hojas-csv');

const INICIO = new Date(Date.UTC(2026, 7, 17));   // 17-ago-2026 = día 0 de misión
const SEMANAS = 12;
const iso = (d) => d.toISOString().slice(0, 10);
const sumarDias = (d, n) => new Date(d.getTime() + n * 864e5);

const NUEVOS = {
  press_pecho:    { etiqueta: 'Press de pecho', musculos: ['pectoral_mayor', 'triceps_braquial', 'deltoides'], cod: 'PECH', carga: 55, fuerza: 950, vel: 0.62, rom: 88, piernas: false },
  carrera_cinta:  { etiqueta: 'Carrera en cinta con arnés', musculos: ['cuadriceps', 'gastrocnemio_soleo', 'gluteo_mayor'], cod: 'CARR', carga: 35, fuerza: 1650, vel: 2.2, rom: 62, piernas: true }
};
const GRUPOS_NUEVOS = { pectoral_mayor: 'Pectoral mayor', triceps_braquial: 'Tríceps braquial', deltoides: 'Deltoides' };
const RMS_BASE = { pectoral_mayor: 150, triceps_braquial: 130, deltoides: 140, cuadriceps: 220, gastrocnemio_soleo: 190, gluteo_mayor: 160 };
const FMED_BASE = { pectoral_mayor: 80, triceps_braquial: 85, deltoides: 78, cuadriceps: 82, gastrocnemio_soleo: 90, gluteo_mayor: 76 };
const ESCALA = { 'AST-001': 0.92, 'AST-002': 1.12, 'AST-003': 0.85 };

/* Aleatorio reproducible (mulberry32) y normal (Box-Muller) */
function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const R = mulberry(20261114);
const normal = (mu = 0, s = 1) => mu + s * Math.sqrt(-2 * Math.log(1 - R())) * Math.cos(2 * Math.PI * R());
const r = (x, d = 1) => Number(x.toFixed(d));
const clip = (x, a, b) => Math.min(b, Math.max(a, x));

function factorFuerza(esc, piernas, w) {
  if (esc === 'estable') return 1 - 0.003 * w;
  if (esc === 'perdida_fuerza') {
    const caida = piernas ? 0.021 : 0.008;
    return w <= 10 ? 1 - caida * w : 1 - caida * 10 + 0.035 * (w - 10);
  }
  return 1 - 0.004 * w;
}
const faseDe = (esc, w) => (w === 0 ? 'basal' : esc === 'perdida_fuerza' && w > 10 ? 'post_entrenamiento' : 'mision');

const BD = JSON.parse(fs.readFileSync(JSON_RUTA, 'utf8'));
if (BD.Catalogos.some((c) => c.lista === 'ejercicio' && c.valor === 'press_pecho')) { console.log('Ya están los ejercicios nuevos: no se hace nada.'); process.exit(0); }

/* ---------------- Catálogos ---------------- */
for (const [v, e] of Object.entries(GRUPOS_NUEVOS)) BD.Catalogos.push({ lista: 'grupo_muscular', valor: v, etiqueta: e, musculos: '' });
for (const [v, e] of Object.entries(NUEVOS)) BD.Catalogos.push({ lista: 'ejercicio', valor: v, etiqueta: e.etiqueta, musculos: e.musculos.join(',') });
// Los grupos van antes que los ejercicios, como en el resto del catálogo
BD.Catalogos.sort((a, b) => ['grupo_muscular', 'ejercicio', 'fase', 'entorno', 'lado', 'tipo_intervencion'].indexOf(a.lista) - ['grupo_muscular', 'ejercicio', 'fase', 'entorno', 'lado', 'tipo_intervencion'].indexOf(b.lista));

/* ---------------- Sesiones + EMG ---------------- */
const nuevasSes = [], nuevasEmg = [];
for (const a of BD.Astronautas) {
  const aid = a.id_astronauta, esc = a.escenario, k = ESCALA[aid];
  for (let w = 0; w <= SEMANAS; w++) {
    const f = w === 0 ? sumarDias(INICIO, -7) : sumarDias(INICIO, 7 * w);
    for (const [ej, e] of Object.entries(NUEVOS)) {
      const fac = factorFuerza(esc, e.piernas, w), ruido = normal(0, 0.012);
      let sim = 98.2 + normal(0, 0.5);
      if (esc === 'asimetria') sim = 98.2 - 1.2 * w + normal(0, 0.6);
      else if (esc === 'perdida_fuerza') sim = 97.8 - 0.15 * w + normal(0, 0.5);
      const id = `SES-${aid.replace('-', '')}-${iso(f).replace(/-/g, '')}-${e.cod}`;
      nuevasSes.push({
        id_sesion: id, id_astronauta: aid, fecha: iso(f), semana_mision: w, fase: faseDe(esc, w), ejercicio: ej,
        carga_kg: Math.round(e.carga * k / 5) * 5, repeticiones: ej === 'carrera_cinta' ? 1 : 8,
        fuerza_pico_n: r(e.fuerza * k * (fac + ruido), 0), velocidad_media_ms: r(e.vel * (fac + normal(0, 0.015)), 2),
        rom_grados: r(e.rom * (1 - (esc === 'perdida_fuerza' && w <= 10 ? 0.004 * w : 0)) + normal(0, 1), 0),
        simetria_pct: r(Math.min(sim, 99.9), 1),
        rpe: clip(Math.round(6 + (esc === 'perdida_fuerza' && w <= 10 ? 0.25 * w : 0) + normal(0, 0.5)), 1, 10),
        notas: ej === 'carrera_cinta' ? 'Bloque de 20 minutos; la carga es la del arnés' : '', registrado_por: 'simulador', registrado_en: `${iso(f)} 09:00`
      });
      for (const m of e.musculos) for (const lado of ['izquierdo', 'derecho']) {
        let rmsFac = 1, fmedFac = 1;
        if (esc === 'perdida_fuerza' && e.piernas) { const ww = Math.min(w, 10) - (w > 10 ? 0.6 * (w - 10) : 0); rmsFac = 1 - 0.012 * ww; fmedFac = 1 - 0.019 * ww; }
        else if (esc === 'asimetria' && lado === 'izquierdo') rmsFac = 1 - 0.022 * w;
        else if (esc === 'estable') fmedFac = 1 - 0.002 * w;
        const rms = RMS_BASE[m] * rmsFac * (1 + normal(0, 0.02));
        nuevasEmg.push({ id_sesion: id, id_astronauta: aid, grupo_muscular: m, lado, rms_uv: r(rms, 1), frec_mediana_hz: r(FMED_BASE[m] * fmedFac * (1 + normal(0, 0.015)), 1), amplitud_pico_uv: r(rms * 3.03 * (1 + normal(0, 0.03)), 0) });
      }
    }
  }
}
BD.Sesiones.push(...nuevasSes);
BD.EMG.push(...nuevasEmg);

/* ---------------- Alertas: mismas reglas que generar_datos.py (umbrales de la pestaña Sesiones) ---------------- */
const reglas = BD.Umbrales.filter((u) => u.tabla === 'Sesiones');
const ORDEN = { verde: 0, amarillo: 1, rojo: 2 };
const nuevasAl = []; let consecutivo = 100;      // ALR-0101 en adelante: no choca con los ids que crea la app
for (const a of BD.Astronautas) for (const [ej, e] of Object.entries(NUEVOS)) {
  const sub = nuevasSes.filter((s) => s.id_astronauta === a.id_astronauta && s.ejercicio === ej).sort((p, q) => p.semana_mision - q.semana_mision);
  const base = sub.filter((s) => s.fase === 'basal'), previo = {};
  for (const s of sub.filter((x) => x.fase !== 'basal')) for (const u of reglas) {
    const ind = u.indicador, val = s[ind], bas = base.reduce((t, x) => t + x[ind], 0) / base.length;
    const m = u.modo === 'pct_vs_basal' ? (val / bas - 1) * 100 : val;
    const malo = u.malo_si === 'baja' ? (x, t) => x <= t : (x, t) => x >= t;
    const nivel = malo(m, u.rojo) ? 'rojo' : malo(m, u.amarillo) ? 'amarillo' : 'verde';
    if (ORDEN[nivel] > ORDEN[previo[ind] || 'verde']) {
      consecutivo++;
      nuevasAl.push({
        id_alerta: `ALR-${String(consecutivo).padStart(4, '0')}`, creada_en: `${s.fecha} 09:05`, id_astronauta: a.id_astronauta, origen: s.id_sesion,
        grupo_muscular: e.musculos[0], indicador: ind, valor_actual: r(val, 2), valor_basal: r(bas, 2), cambio_pct: r((val / bas - 1) * 100, 1), nivel,
        mensaje: `${u.nombre_visible} en ${e.etiqueta.toLowerCase()}: ${Math.abs(Math.round((val / bas - 1) * 100))} % ${val < bas ? 'por debajo' : 'por encima'} de la basal`,
        recomendacion: u['recomendacion_' + nivel], estado: 'abierta', atendida_por: '', nota_cierre: ''
      });
    }
    previo[ind] = nivel;
  }
}
// Un amarillo que luego escaló a rojo en el mismo ejercicio e indicador queda "en seguimiento"
for (const al of nuevasAl) if (al.nivel === 'amarillo' && nuevasAl.some((o) => o.id_astronauta === al.id_astronauta && o.origen.split('-').pop() === al.origen.split('-').pop() && o.indicador === al.indicador && o.nivel === 'rojo')) al.estado = 'en_seguimiento';
BD.Alertas.push(...nuevasAl);

/* ---------------- Escribir ---------------- */
fs.writeFileSync(JSON_RUTA, JSON.stringify(BD, null, 1) + '\n');
const gs = fs.readFileSync(GS_RUTA, 'utf8'), i = gs.indexOf('const DATOS_EJEMPLO = ') + 'const DATOS_EJEMPLO = '.length, f = gs.lastIndexOf('};') + 1;
fs.writeFileSync(GS_RUTA, gs.slice(0, i) + JSON.stringify(BD) + gs.slice(f));
const q = (v) => { v = String(v ?? ''); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
for (const hoja of ['Catalogos', 'Sesiones', 'EMG', 'Alertas']) {
  const cols = Object.keys(BD[hoja][0]);
  fs.writeFileSync(path.join(CSV_DIR, hoja + '.csv'), '﻿' + cols.join(',') + '\n' + BD[hoja].map((fila) => cols.map((c) => q(fila[c])).join(',')).join('\n') + '\n');
}
console.log(`Agregado: ${nuevasSes.length} sesiones, ${nuevasEmg.length} filas de EMG, ${nuevasAl.length} alertas, ${Object.keys(GRUPOS_NUEVOS).length} grupos y ${Object.keys(NUEVOS).length} ejercicios.`);
