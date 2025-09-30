// src/api/worker.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';

// Impor kelas ChatRoom yang baru kita buat
export { ChatRoom } from './chatRoom';

const app = new Hono<{ Bindings: { CHAT_ROOM: DurableObjectNamespace } }>();

// Kebijakan CORS tetap sama
app.use('*', cors({
  origin: (origin) => {
    if (origin.endsWith('.vercel.app')) {
      return origin;
    }
    return 'https://vite-react-workers.vercel.app';
  }
}));

const api = new Hono<{ Bindings: { CHAT_ROOM: DurableObjectNamespace } }>();

api.get('/who', (c) => c.json({ name: 'Safa Framework' }));

// Endpoint universal untuk chat yang akan diteruskan ke Durable Object
api.all('/chat/*', async (c) => {
  // 1. Dapatkan ID unik untuk Durable Object kita.
  //    Kita gunakan ID statis "v1" agar semua pengguna terhubung ke objek yang sama.
  const id = c.env.CHAT_ROOM.idFromName("v1");

  // 2. Dapatkan "stub", yaitu pointer ke instance Durable Object yang sebenarnya.
  const room = c.env.CHAT_ROOM.get(id);

  // 3. Teruskan request dari klien langsung ke Durable Object.
  //    Durable Object akan menangani logika WebSocket dan POST.
  const url = new URL(c.req.url);
  const path = url.pathname.replace('/api/chat', ''); // /websocket atau /message

  return room.fetch(`https://chat.internal${path}`, c.req.raw);
});

app.route('/api', api);

export default app;