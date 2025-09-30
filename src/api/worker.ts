/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
// src/api/worker.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE, SSEStreamingApi } from 'hono/streaming';

type ChatPayload = { user: string; text: string; ts?: string };
type SSEEntry = { stream: SSEStreamingApi; id: string };

const app = new Hono<{ Bindings: Env }>();

// Simple CORS (sesuaikan origin)
const allowedOrigins = [
  'https://vite-react-workers.vercel.app',
];

app.use('*', cors({
  origin: (origin) => {
    if (!origin) return 'https://vite-react-workers.vercel.app';
    if (allowedOrigins.includes(origin)) return origin;
    if (/\.vercel\.app$/.test(origin)) return origin;
    return 'https://vite-react-workers.vercel.app';
  }
}));

const api = new Hono<{ Bindings: Env }>();

api.get('/who', (c) => c.json({ name: 'Safa Framework' }));

/**
 * In-memory broadcaster:
 * - connected: Set of SSEStream writers (wrapped)
 *
 * Note: In Cloudflare Workers / serverless env this is ephemeral and not reliable
 * across multiple instances — for production gunakan Durable Objects / Redis / PubSub.
 */
const connected = new Set<SSEStreamingApi>();

function broadcast(payload: ChatPayload, eventName = 'message') {
  const data = JSON.stringify(payload);
  // Copy to array to avoid mutation while iterating
  Array.from(connected).forEach(async (s) => {
    try {
      await s.writeSSE({ event: eventName, data });
    } catch (err: any) {
      // ignore write errors; streamSSE will close broken streams automatically
    }
  });
}

// Helper to create server-side bot greeting
function botGreetingFor(user = 'guest'): ChatPayload {
  return {
    user: 'bot',
    text: `Halo ${user}! Selamat datang di chat — saya bot siap bantu.`,
    ts: new Date().toISOString(),
  };
}

// SSE endpoint for clients to listen to chat
api.get('/chat', (c) => {
  return streamSSE(c, async (stream) => {
    // Add stream to connected set
    connected.add(stream);

    // Send initial welcome message to the new client (optional: as private)
    // Here we broadcast bot join so everyone sees it
    const greet = botGreetingFor('pengguna baru');
    await stream.writeSSE({ event: 'joined', data: JSON.stringify(greet) });
    broadcast(greet, 'joined');

    // keep the connection alive with a comment ping every 20s
    const keepAlive = setInterval(() => {
      // some runtimes ignore comment; using writeSSE with empty data works
      stream.writeSSE({ data: '' }).catch(() => { });
    }, 20_000);

    // wait until client closes connection (streamSSE promise resolves when closed)
    await new Promise<void>((resolve) => {
      stream.onAbort(() => {
        resolve();
      });
    });

    // cleanup
    clearInterval(keepAlive);
    connected.delete(stream);

    // broadcast that a user left (optional)
    const leave: ChatPayload = { user: 'bot', text: 'Seorang pengguna meninggalkan chat.', ts: new Date().toISOString() };
    broadcast(leave, 'left');
  });
});

// POST endpoint agar client mengirim pesan ke semua listener SSE
api.post('/chat', async (c) => {
  try {
    const body = await c.req.json() as Partial<ChatPayload> | undefined;
    if (!body || typeof body.text !== 'string' || typeof body.user !== 'string') {
      return c.json({ ok: false, error: 'bad payload, expected { user, text }' }, 400);
    }

    const payload: ChatPayload = {
      user: body.user,
      text: body.text,
      ts: new Date().toISOString(),
    };

    // broadcast to all connected SSE clients
    broadcast(payload, 'message');

    // simple echo response
    return c.json({ ok: true, payload });
  } catch (err) {
    return c.json({ ok: false, error: (err as Error).message }, 500);
  }
});

app.route('/api', api);

export default app;
