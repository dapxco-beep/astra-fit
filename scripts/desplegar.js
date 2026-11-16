/**
 * desplegar.js — Despliegue seguro a Cloudflare. Evita publicar desde una carpeta atrasada o con cambios sin guardar.
 *
 *   node scripts/desplegar.js
 *
 * Pasos: 1) estar en main, sin cambios sin guardar y al día con origin/main; 2) armar publicar-cloudflare/;
 * 3) prueba de humo en local; 4) npx wrangler deploy; 5) prueba de humo contra el sitio publicado.
 * Solo una persona despliega, siempre con este script (anótalo en docs/equipo/NOTAS.md).
 */
const { execSync, spawn } = require('child_process');
const PROD = 'https://myocare.dapxco.workers.dev/';
const sh = (c) => execSync(c, { stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim();
const run = (c) => execSync(c, { stdio: 'inherit' });
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  sh('git fetch origin');
  if (sh('git branch --show-current') !== 'main') throw new Error('Despliega solo desde la rama main.');
  if (sh('git status --porcelain')) throw new Error('Hay cambios sin guardar: haz commit o descártalos antes de desplegar.');
  if (sh('git rev-parse HEAD') !== sh('git rev-parse origin/main')) throw new Error('Tu main no coincide con origin/main: haz git pull (o git push) primero.');
  console.log('main al día: ' + sh('git rev-parse --short HEAD'));

  run('node astra-fit/publicar/construir-cloudflare.js');

  const puerto = 3099;
  const servidor = spawn(process.execPath, ['astra-fit/local/server.js'], { env: { ...process.env, PORT: String(puerto) }, stdio: 'ignore' });
  try {
    for (let i = 0; i < 30; i++) { try { if ((await fetch('http://localhost:' + puerto + '/')).ok) break; } catch (e) { /* aún no */ } await pausa(500); }
    run('node scripts/humo.js http://localhost:' + puerto + '/');
  } finally { servidor.kill(); }

  run('npx wrangler deploy');
  await pausa(3000);
  run('node scripts/humo.js ' + PROD);
  console.log('\nDesplegado: ' + sh('git rev-parse --short HEAD'));
})().catch((e) => { console.error('\nNO se desplegó: ' + e.message); process.exit(1); });
