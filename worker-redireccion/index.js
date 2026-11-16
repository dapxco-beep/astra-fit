/**
 * Redirección de la dirección vieja (astra-fit-modelos.dapxco.workers.dev) a la nueva (myocare.dapxco.workers.dev).
 * Conserva la ruta, la consulta y el #vista. Usa 308 para que las peticiones POST de /api lleguen igual a la nueva.
 * Se publica aparte: npx wrangler deploy --config worker-redireccion/wrangler.jsonc
 */
const DESTINO = 'https://myocare.dapxco.workers.dev';

export default {
  fetch(request) {
    const url = new URL(request.url);
    return new Response(null, {
      status: 308,
      headers: { Location: DESTINO + url.pathname + url.search, 'Cache-Control': 'public, max-age=3600' }
    });
  }
};
