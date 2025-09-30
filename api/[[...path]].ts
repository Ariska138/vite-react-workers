// api/[...path].ts  (Vercel Edge Function - TypeScript)
// Purpose: proxy semua /api/* ke https://worker.finlup.id/api/* dan forward streaming + headers
export const config = { runtime: 'edge' };

const WORKER_BASE = 'https://worker.finlup.id';

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
]);

function filterHeaders(headers: Headers) {
  const out = new Headers();
  for (const [k, v] of headers.entries()) {
    if (!HOP_BY_HOP.has(k.toLowerCase())) out.set(k, v);
  }
  return out;
}

export default async function handler(req: Request) {
  try {
    const url = new URL(req.url);
    // req comes as https://<vercel-domain>/api/<path>
    // we want to forward to https://worker.finlup.id/api/<path>
    const path = url.pathname.replace(/^\/api/, '/api'); // clarity
    const target = `${WORKER_BASE}${path}${url.search}`;

    // Build forwarded headers (filter hop-by-hop)
    const forwardedHeaders = filterHeaders(req.headers);

    // Optionally override Host header of forwarded request:
    // forwardedHeaders.set('host', new URL(WORKER_BASE).host);

    // Create Request to worker. Use streamable body where available.
    const forwardedReq = new Request(target, {
      method: req.method,
      headers: forwardedHeaders,
      // In Edge, req.body is a ReadableStream | null — pass through for streaming support
      body: req.body,
      // keep same redirect behavior
      redirect: 'manual',
    });

    const resFromWorker = await fetch(forwardedReq);

    // Prepare response headers for client (filter hop-by-hop)
    const resHeaders = filterHeaders(resFromWorker.headers);

    // Ensure CORS header allows the browser origin (optional)
    // If your worker already sets Access-Control-Allow-Origin to the Vercel origin, you can skip this.
    // Otherwise uncomment the following line and replace with your Vercel origin:
    // resHeaders.set('Access-Control-Allow-Origin', 'https://vite-react-workers.vercel.app');

    return new Response(resFromWorker.body, {
      status: resFromWorker.status,
      headers: resHeaders,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response('Proxy error: ' + message, { status: 502 });
  }
}
