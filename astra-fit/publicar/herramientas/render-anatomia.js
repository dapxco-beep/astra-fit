// Regenera las imágenes de anatomía (assets/anatomia2d/) a partir del modelo 3D. Requiere el servidor local en :3000 (INICIAR-WINDOWS.bat) y Chrome.
// Uso: node astra-fit/publicar/herramientas/render-anatomia.js [M,F]
// Dibuja la anatomía (capa base y una máscara por grupo) y guarda PNG + JSON en NASA/assets/anatomia2d/
const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path');
const S = __dirname, SALIDA = 'c:/Users/danie/DANIEL/NASA/assets/anatomia2d', PUERTO = 9388;
const sexos = (process.argv[2] || 'M,F').split(','), solo = process.argv[3] || '';
fs.mkdirSync(SALIDA, { recursive: true });
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars',
  '--remote-debugging-port=' + PUERTO, '--user-data-dir=' + path.join(require('os').tmpdir(), 'astra-fit-render-chrome'), '--no-first-run', 'about:blank'], { stdio: 'ignore' });
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  let ws, id = 0; const pend = new Map(); const logs = [];
  try {
    let info; for (let i = 0; i < 40; i++) { try { info = await (await fetch(`http://127.0.0.1:${PUERTO}/json`)).json(); if (info.find((t) => t.type === 'page')) break; } catch (e) {} await dormir(300); }
    ws = new WebSocket(info.find((t) => t.type === 'page').webSocketDebuggerUrl); await new Promise((r) => { ws.onopen = r; });
    ws.onmessage = (m) => { const d = JSON.parse(m.data);
      if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
      else if (d.method === 'Runtime.exceptionThrown') logs.push('EXC ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).split('\n')[0]); };
    const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
    const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'error'); return r.result?.result?.value; };
    await send('Page.enable'); await send('Runtime.enable');
    await send('Page.navigate', { url: 'http://localhost:3000/publicar/herramientas/render-anatomia.html' });
    for (let i = 0; i < 60; i++) { await dormir(1000); if (await ev('window.listo === true')) break; }
    const centros = {};
    for (const sx of sexos) {
      centros[sx] = { front: {}, back: {} };
      const plan = [['front', 'base'], ['front', 'quad'], ['back', 'base'], ['back', 'glute'], ['back', 'back'], ['back', 'gastro']];
      for (const [vista, modo] of plan) {
        if (solo && modo !== solo) continue;
        const r = await ev(`dibujar('${sx}', '${vista}', '${modo}')`);
        const archivo = `${sx.toLowerCase()}-${vista}-${modo}.png`;
        fs.writeFileSync(path.join(SALIDA, archivo), Buffer.from(r.png.split(',')[1], 'base64'));
        if (r.bb) centros[sx][vista][modo] = r.bb;
        console.log(archivo, (fs.statSync(path.join(SALIDA, archivo)).size / 1024).toFixed(0) + ' KB', r.bb ? JSON.stringify(r.bb, (k, v) => typeof v === 'number' ? +v.toFixed(3) : v) : '');
      }
    }
    if (!solo) fs.writeFileSync(path.join(SALIDA, 'zonas.json'), JSON.stringify(centros));
    console.log('Errores:', JSON.stringify(logs.slice(0, 5)));
  } catch (e) { console.log('FALLO', e.message); }
  try { ws && ws.close(); } catch (e) {}
  chrome.kill(); setTimeout(() => process.exit(0), 500);
})();
