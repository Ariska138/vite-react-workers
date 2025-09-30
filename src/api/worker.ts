/* eslint-disable @typescript-eslint/no-explicit-any */
// src/api/worker.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { DurableObjectNamespace } from '@cloudflare/workers-types';

import { ChatRoom, InMemoryChatRoom } from './chatRoom';

type Bindings = {
  CHAT_ROOM?: DurableObjectNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', cors({
  origin: (origin) => {
    if (!origin || origin.endsWith('.vercel.app') || new URL(origin).hostname === 'localhost') {
      return origin;
    }
    return 'https://vite-react-workers.vercel.app';
  }
}));

const api = new Hono<{ Bindings: Bindings }>();

api.get('/who', (c) => c.json({ name: 'Safa Framework' }));

api.all('/chat/*', async (c) => {
  if (c.env.CHAT_ROOM) {
    console.log("[Chat] Menggunakan mode: Durable Object");
    const id = c.env.CHAT_ROOM.idFromName("v1");
    const room = c.env.CHAT_ROOM.get(id);
    const path = new URL(c.req.url).pathname.replace('/api/chat', '');
    const newUrl = `https://chat.internal${path}`;

    const requestInit = {
      method: c.req.method,
      headers: c.req.header(),
      body: c.req.method !== 'GET' && c.req.method !== 'HEAD' ? c.req.raw.body : null,
      redirect: 'manual',
    };

    // --- PERUBAHAN DI SINI ---
    // Setelah mendapatkan respons, tegaskan tipenya sebagai `Response` standar global.
    const doResponse = await room.fetch(newUrl, requestInit as any) as Response;
    // --- AKHIR PERUBAHAN ---

    // Sekarang, `doResponse.body` dan `doResponse.headers` akan memiliki tipe yang benar.
    return new Response(doResponse.body, {
      status: doResponse.status,
      headers: doResponse.headers,
    });

  } else {
    console.log("[Chat] Menggunakan mode: In-Memory");
    // Gunakan globalThis.Request untuk kejelasan di sini juga
    return InMemoryChatRoom.handleRequest(c.req.raw as globalThis.Request);
  }
});

app.route('/api', api);

export { ChatRoom };
export default app;