/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// src/api/chatRoom.ts
import type { DurableObjectState } from '@cloudflare/workers-types';

/* =====================================================================
 * Tipe Data dan Fungsi Bersama
 * ===================================================================== */

type ChatPayload = {
  id: string;
  user: string;
  text: string;
  ts: string;
  type: 'user' | 'bot' | 'system';
};

function encodeSseMessage(payload: Omit<ChatPayload, 'id' | 'ts'>): string {
  const message: ChatPayload = {
    ...payload,
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
  };
  const data = JSON.stringify(message);
  return `data: ${data}\n\n`;
}


/* =====================================================================
 * Implementasi 1: Cloudflare Durable Object (Untuk Produksi)
 * ===================================================================== */

export class ChatRoom {
  state: DurableObjectState;
  controllers: Set<ReadableStreamDefaultController> = new Set();

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  broadcast(payload: Omit<ChatPayload, 'id' | 'ts'>) {
    const message = encodeSseMessage(payload);
    this.controllers.forEach(controller => {
      try {
        controller.enqueue(message);
      } catch (err) {
        this.controllers.delete(controller);
      }
    });
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/events")) {
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const controller = {
        enqueue: (chunk: string) => writer.write(new TextEncoder().encode(chunk)),
        close: () => writer.close(),
        error: (err: any) => writer.abort(err),
      };

      this.controllers.add(controller as any);

      request.signal.addEventListener('abort', () => {
        this.controllers.delete(controller as any);
        this.broadcast({ user: 'system', text: 'Seorang pengguna meninggalkan chat.', type: 'system' });
      }, { once: true });

      this.broadcast({ user: 'bot', text: 'Seorang pengguna baru telah bergabung.', type: 'bot' });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    if (request.method === "POST" && url.pathname.endsWith("/message")) {
      try {
        const body = await request.json<{ user?: string; text?: string }>();
        if (!body || typeof body.text !== 'string' || typeof body.user !== 'string') {
          return new Response('Payload tidak valid', { status: 400 });
        }
        const payload: Omit<ChatPayload, 'id' | 'ts'> = { user: body.user, text: body.text, type: 'user' };
        this.broadcast(payload);
        return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
      } catch (err) {
        return new Response((err as Error).message, { status: 500 });
      }
    }

    return new Response("Not found", { status: 404 });
  }
}


/* =====================================================================
 * Implementasi 2: In-Memory (Untuk Pengembangan Lokal)
 * ===================================================================== */

const inMemoryControllers: Set<ReadableStreamDefaultController> = new Set();

function inMemoryBroadcast(payload: Omit<ChatPayload, 'id' | 'ts'>) {
  const message = encodeSseMessage(payload);
  inMemoryControllers.forEach(controller => {
    try {
      controller.enqueue(message);
    } catch (err) {
      inMemoryControllers.delete(controller);
    }
  });
}

export class InMemoryChatRoom {
  // --- PERUBAHAN DI SINI ---
  // Secara eksplisit gunakan tipe `Request` global untuk menghindari konflik
  static async handleRequest(request: globalThis.Request) {
  // --- AKHIR PERUBAHAN ---
    const url = new URL(request.url);

    if (url.pathname.endsWith("/events")) {
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const controller = {
        enqueue: (chunk: string) => writer.write(new TextEncoder().encode(chunk)),
        close: () => writer.close(),
        error: (err: any) => writer.abort(err),
      };

      inMemoryControllers.add(controller as any);

      request.signal.addEventListener('abort', () => {
        inMemoryControllers.delete(controller as any);
        inMemoryBroadcast({ user: 'system', text: 'Seorang pengguna meninggalkan chat.', type: 'system' });
      }, { once: true });

      inMemoryBroadcast({ user: 'bot', text: 'Seorang pengguna baru telah bergabung.', type: 'bot' });

      return new Response(readable, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' } });
    }

    if (request.method === "POST" && url.pathname.endsWith("/message")) {
      try {
        const body = await request.json<{ user?: string; text?: string }>();
        if (!body || typeof body.text !== 'string' || typeof body.user !== 'string') {
          return new Response('Payload tidak valid', { status: 400 });
        }
        const payload: Omit<ChatPayload, 'id' | 'ts'> = { user: body.user, text: body.text, type: 'user' };
        inMemoryBroadcast(payload);
        return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
      } catch (err) {
        return new Response((err as Error).message, { status: 500 });
      }
    }

    return new Response("Not found", { status: 404 });
  }
}