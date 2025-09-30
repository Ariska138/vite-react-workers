// api/[[...path]].ts
export const config = { runtime: 'edge' };

const WORKER_BASE = 'https://worker.finlup.id';

const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailers', 'transfer-encoding', 'upgrade',
]);

function filterHeaders(headers: Headers) {
  const out = new Headers();
  for (const [k, v] of headers.entries()) {
    if (!HOP_BY_HOP.has(k.toLowerCase())) out.set(k, v);
  }
  return out;
}

export default async function handler(req: Request) {
  console.log(`[Vercel Proxy] Menerima request untuk: ${req.url}`); // <-- LOG 1
  try {
    const url = new URL(req.url);
    const afterApi = url.pathname.replace(/^\/api/, '') || '';
    const target = `${WORKER_BASE}/api${afterApi}${url.search}`;
    console.log(`[Vercel Proxy] Meneruskan ke: ${target}`); // <-- LOG 2

    const forwardedHeaders = filterHeaders(req.headers);
    const forwardedReq = new Request(target, {
      method: req.method,
      headers: forwardedHeaders,
      body: req.body,
      redirect: 'manual',
    });

    const resFromWorker = await fetch(forwardedReq);
    console.log(`[Vercel Proxy] Menerima status ${resFromWorker.status} dari worker.`); // <-- LOG 3

    const resHeaders = filterHeaders(resFromWorker.headers);
    return new Response(resFromWorker.body, {
      status: resFromWorker.status,
      headers: resHeaders,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Vercel Proxy] TERJADI ERROR: ${message}`); // <-- LOG 4
    return new Response('Proxy error: ' + message, { status: 502 });
  }
}