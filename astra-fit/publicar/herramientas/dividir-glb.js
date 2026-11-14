/**
 * dividir-glb.js — Adelgaza los modelos 3D del visor del cuerpo sin instalar nada (solo Node).
 *
 *   node astra-fit/publicar/herramientas/dividir-glb.js
 *
 * Qué hace (los bytes comprimidos con meshopt se copian tal cual, no se vuelven a comprimir ni se pierde calidad):
 *   - anatomy-male/female.glb  →  *-musculos.glb  (solo los músculos: lo único que se ve al abrir el visor)
 *                              →  *-resto.glb     (huesos, órganos, vasos y nervios: se bajan solo si se elige esa capa)
 *   - Xbot.glb                 →  Xbot-animaciones.glb  (solo los huesos y las 7 animaciones: la silueta del Xbot nunca se muestra)
 * Los archivos originales no se tocan.
 */
const fs = require('fs');
const path = require('path');
const ASSETS = path.join(__dirname, '..', '..', '..', 'assets');

function leerGLB(archivo) {
  const b = fs.readFileSync(archivo);
  if (b.readUInt32LE(0) !== 0x46546C67) throw new Error('No es un GLB: ' + archivo);
  const nj = b.readUInt32LE(12), json = JSON.parse(b.slice(20, 20 + nj).toString('utf8'));
  const inicioBin = 20 + nj, nb = b.readUInt32LE(inicioBin), bin = b.slice(inicioBin + 8, inicioBin + 8 + nb);
  return { json, bin };
}
function escribirGLB(archivo, json, bin) {
  let js = Buffer.from(JSON.stringify(json), 'utf8'); js = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 0x20)]);
  const bn = Buffer.concat([bin, Buffer.alloc((4 - bin.length % 4) % 4, 0)]);
  const total = 12 + 8 + js.length + 8 + bn.length, h = Buffer.alloc(12);
  h.writeUInt32LE(0x46546C67, 0); h.writeUInt32LE(2, 4); h.writeUInt32LE(total, 8);
  const c0 = Buffer.alloc(8); c0.writeUInt32LE(js.length, 0); c0.writeUInt32LE(0x4E4F534A, 4);
  const c1 = Buffer.alloc(8); c1.writeUInt32LE(bn.length, 0); c1.writeUInt32LE(0x004E4942, 4);
  fs.writeFileSync(archivo, Buffer.concat([h, c0, js, c1, bn, ]));
}

/**
 * Crea un GLB nuevo con solo parte del original.
 *  raices:        nombres de los nodos raíz de la escena que se conservan (si es null, se conservan todas)
 *  sinMallas:     true = se quitan mallas y pieles (queda solo el esqueleto de nodos y las animaciones)
 */
function extraer(origen, destino, { raices = null, sinMallas = false } = {}) {
  const { json: j, bin } = leerGLB(origen);
  const escena = j.scenes[j.scene || 0], rootsOrig = escena.nodes;
  const rootsKeep = raices ? rootsOrig.filter((i) => raices.includes(j.nodes[i].name)) : rootsOrig.slice();
  if (!rootsKeep.length) throw new Error('Ninguna raíz coincide con ' + raices);

  // 1) Nodos que se conservan (todo el subárbol de cada raíz), en el orden original para que los índices sigan estables
  const nodos = new Set(); (function rec(i) { nodos.add(i); (j.nodes[i].children || []).forEach(rec); }); rootsKeep.forEach(function rec(i) { nodos.add(i); (j.nodes[i].children || []).forEach(rec); });
  const nodosOrden = [...nodos].sort((a, b) => a - b), nodoNuevo = new Map(nodosOrden.map((v, k) => [v, k]));

  // 2) Qué mallas, accesores y vistas hacen falta
  const mallas = new Set(), accesores = new Set(), materiales = new Set();
  if (!sinMallas) nodosOrden.forEach((i) => { if (j.nodes[i].mesh !== undefined) mallas.add(j.nodes[i].mesh); });
  const mallasOrden = [...mallas].sort((a, b) => a - b), mallaNueva = new Map(mallasOrden.map((v, k) => [v, k]));
  mallasOrden.forEach((m) => j.meshes[m].primitives.forEach((p) => { Object.values(p.attributes).forEach((a) => accesores.add(a)); if (p.indices !== undefined) accesores.add(p.indices); if (p.material !== undefined) materiales.add(p.material); }));
  const pieles = new Set(); if (!sinMallas) nodosOrden.forEach((i) => { if (j.nodes[i].skin !== undefined) pieles.add(j.nodes[i].skin); });
  const pielesOrden = [...pieles].sort((a, b) => a - b), pielNueva = new Map(pielesOrden.map((v, k) => [v, k]));
  pielesOrden.forEach((s) => { if (j.skins[s].inverseBindMatrices !== undefined) accesores.add(j.skins[s].inverseBindMatrices); });
  // Animaciones: solo los canales que mueven nodos conservados
  const animaciones = (j.animations || []).map((an) => {
    const canales = an.channels.filter((c) => nodos.has(c.target.node)), muestras = [...new Set(canales.map((c) => c.sampler))].sort((a, b) => a - b), mapa = new Map(muestras.map((v, k) => [v, k]));
    muestras.forEach((s) => { accesores.add(an.samplers[s].input); accesores.add(an.samplers[s].output); });
    return { an, canales, muestras, mapa };
  }).filter((x) => x.canales.length);
  const matOrden = [...materiales].sort((a, b) => a - b), matNuevo = new Map(matOrden.map((v, k) => [v, k]));
  const accOrden = [...accesores].sort((a, b) => a - b), accNuevo = new Map(accOrden.map((v, k) => [v, k]));
  const vistas = new Set(); accOrden.forEach((a) => { const ac = j.accessors[a]; if (ac.bufferView !== undefined) vistas.add(ac.bufferView); if (ac.sparse) throw new Error('Accesor disperso: no soportado'); });
  const vistasOrden = [...vistas].sort((a, b) => a - b), vistaNueva = new Map(vistasOrden.map((v, k) => [v, k]));

  // 3) Nuevo buffer con solo los bytes que se usan (los de meshopt viven en la extensión, el resto en la propia vista)
  const trozos = []; let pos = 0;
  const vistasNuevas = vistasOrden.map((v) => {
    const bv = JSON.parse(JSON.stringify(j.bufferViews[v])), ext = bv.extensions && bv.extensions.EXT_meshopt_compression, src = ext || bv;
    if ((ext ? ext.buffer : bv.buffer) !== 0) throw new Error('Vista fuera del buffer 0');
    const datos = bin.slice(src.byteOffset || 0, (src.byteOffset || 0) + src.byteLength);
    trozos.push(datos, Buffer.alloc((4 - datos.length % 4) % 4, 0));
    if (ext) ext.byteOffset = pos; else bv.byteOffset = pos;
    pos += datos.length + (4 - datos.length % 4) % 4;
    return bv;
  });
  const nuevaBin = Buffer.concat(trozos);

  // 4) JSON nuevo
  const out = { asset: j.asset };
  if (j.extensionsUsed) out.extensionsUsed = j.extensionsUsed; if (j.extensionsRequired) out.extensionsRequired = j.extensionsRequired;
  out.scene = 0; out.scenes = [{ ...escena, nodes: rootsKeep.map((i) => nodoNuevo.get(i)) }];
  out.nodes = nodosOrden.map((i) => {
    const n = JSON.parse(JSON.stringify(j.nodes[i]));
    if (n.children) n.children = n.children.map((c) => nodoNuevo.get(c));
    if (sinMallas) { delete n.mesh; delete n.skin; } else { if (n.mesh !== undefined) n.mesh = mallaNueva.get(n.mesh); if (n.skin !== undefined) n.skin = pielNueva.get(n.skin); }
    return n;
  });
  if (mallasOrden.length) out.meshes = mallasOrden.map((m) => { const me = JSON.parse(JSON.stringify(j.meshes[m])); me.primitives.forEach((p) => { for (const k of Object.keys(p.attributes)) p.attributes[k] = accNuevo.get(p.attributes[k]); if (p.indices !== undefined) p.indices = accNuevo.get(p.indices); if (p.material !== undefined) p.material = matNuevo.get(p.material); }); return me; });
  if (matOrden.length) out.materials = matOrden.map((m) => j.materials[m]);
  if (pielesOrden.length) out.skins = pielesOrden.map((s) => { const sk = JSON.parse(JSON.stringify(j.skins[s])); sk.joints = sk.joints.map((n) => nodoNuevo.get(n)); if (sk.skeleton !== undefined) sk.skeleton = nodoNuevo.get(sk.skeleton); if (sk.inverseBindMatrices !== undefined) sk.inverseBindMatrices = accNuevo.get(sk.inverseBindMatrices); return sk; });
  if (animaciones.length) out.animations = animaciones.map(({ an, canales, muestras, mapa }) => ({
    ...(an.name ? { name: an.name } : {}),
    channels: canales.map((c) => ({ sampler: mapa.get(c.sampler), target: { ...c.target, node: nodoNuevo.get(c.target.node) } })),
    samplers: muestras.map((s) => ({ ...an.samplers[s], input: accNuevo.get(an.samplers[s].input), output: accNuevo.get(an.samplers[s].output) }))
  }));
  out.accessors = accOrden.map((a) => { const ac = JSON.parse(JSON.stringify(j.accessors[a])); if (ac.bufferView !== undefined) ac.bufferView = vistaNueva.get(ac.bufferView); return ac; });
  out.bufferViews = vistasNuevas;
  // Buffer 0 = datos reales. Si hay meshopt, el buffer 1 es el "de reserva" (sin datos): se conserva con su tamaño original.
  out.buffers = j.buffers.map((b, i) => i === 0 ? { byteLength: nuevaBin.length } : b);
  if (!out.bufferViews.some((v) => v.extensions && v.extensions.EXT_meshopt_compression) && out.buffers.length > 1) out.buffers = [out.buffers[0]];
  escribirGLB(destino, out, nuevaBin);
  return { nodos: nodosOrden.length, mallas: mallasOrden.length, animaciones: animaciones.length, bytes: fs.statSync(destino).size };
}

const mb = (n) => (n / 1048576).toFixed(2) + ' MB';
function informe(nombre, origen, destino, resultado) { console.log(`${nombre.padEnd(30)} ${mb(fs.statSync(origen).size).padStart(9)} → ${mb(resultado.bytes).padStart(9)}   (${resultado.nodos} nodos, ${resultado.mallas} mallas, ${resultado.animaciones} animaciones)`); }

for (const sx of ['male', 'female']) {
  const o = path.join(ASSETS, `anatomy-${sx}.glb`);
  for (const [sufijo, raices] of [['musculos', ['muscles']], ['resto', ['skeleton', 'organs', 'vessels', 'nerves']]]) {
    const d = path.join(ASSETS, `anatomy-${sx}-${sufijo}.glb`);
    informe(`anatomy-${sx}-${sufijo}.glb`, o, d, extraer(o, d, { raices }));
  }
}
const xo = path.join(ASSETS, 'Xbot.glb'), xd = path.join(ASSETS, 'Xbot-animaciones.glb');
informe('Xbot-animaciones.glb', xo, xd, extraer(xo, xd, { sinMallas: true }));
