// api/[[...path]].ts  (Vercel Edge Function - TypeScript, optional catch-all)
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
    // If no path segments after /api, use '' so target becomes /api
    const afterApi = url.pathname.replace(/^\/api/, '') || ''; // '' or '/time' etc.
    const target = `${WORKER_BASE}/api${afterApi}${url.search}`;

    const forwardedHeaders = filterHeaders(req.headers);
    // forwardedHeaders.set('host', new URL(WORKER_BASE).host); // optional

    const forwardedReq = new Request(target, {
      method: req.method,
      headers: forwardedHeaders,
      body: req.body,
      redirect: 'manual',
    });

    const resFromWorker = await fetch(forwardedReq);

    const resHeaders = filterHeaders(resFromWorker.headers);

    // Uncomment if you need to force CORS from Vercel origin:
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
