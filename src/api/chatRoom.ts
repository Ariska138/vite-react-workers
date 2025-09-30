/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// src/api/chatRoom.ts

// Tipe data yang sama seperti di worker Anda
type ChatPayload = {
  id: string;
  user: string;
  text: string;
  ts: string;
  type: 'user' | 'bot' | 'system';
};

export class ChatRoom {
  state: DurableObjectState;
  // Ganti array WebSocket dengan Set dari stream controllers untuk SSE
  controllers: Set<ReadableStreamDefaultController> = new Set();

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  // Fungsi helper untuk meng-encode pesan ke format SSE
  encodeMessage(payload: Omit<ChatPayload, 'id' | 'ts'>): string {
    const message: ChatPayload = {
      ...payload,
      id: crypto.randomUUID(),
      ts: new Date().toISOString(),
    };
    const data = JSON.stringify(message);
    // Format SSE: "data: <json string>\n\n"
    return `data: ${data}\n\n`;
  }

  // Fungsi broadcast sekarang menggunakan stream controllers
  broadcast(payload: Omit<ChatPayload, 'id' | 'ts'>) {
    const message = this.encodeMessage(payload);
    // Kirim pesan ke setiap klien yang terhubung
    this.controllers.forEach(controller => {
      try {
        controller.enqueue(message);
      } catch (err) {
        // Controller ini kemungkinan sudah ditutup, hapus dari daftar
        this.controllers.delete(controller);
      }
    });
  }

  // Metode fetch yang dipanggil oleh worker utama
  async fetch(request: Request) {
    const url = new URL(request.url);

    // Rute untuk membuat koneksi SSE
    if (url.pathname.endsWith("/events")) {
      // Buat stream yang bisa kita tulis dan bisa dibaca oleh klien.
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const controller = {
        enqueue: (chunk: string) => writer.write(new TextEncoder().encode(chunk)),
        close: () => writer.close(),
        error: (err: any) => writer.abort(err),
      };

      this.controllers.add(controller as any); // Simpan controller

      // Saat klien memutuskan koneksi, readable stream akan di-abort.
      request.signal.addEventListener('abort', () => {
        this.controllers.delete(controller as any);
        // Siarkan bahwa pengguna telah pergi
        this.broadcast({
          user: 'system',
          text: 'Seorang pengguna meninggalkan chat.',
          type: 'system'
        });
      }, { once: true });

      // Siarkan pesan selamat datang saat pengguna baru bergabung
      this.broadcast({
        user: 'bot',
        text: 'Seorang pengguna baru telah bergabung.',
        type: 'bot'
      });

      // Kembalikan response streaming
      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Rute untuk menerima pesan via POST (tetap sama)
    if (request.method === "POST" && url.pathname.endsWith("/message")) {
      try {
        const body = await request.json<{ user?: string; text?: string }>();
        if (!body || typeof body.text !== 'string' || typeof body.user !== 'string') {
          return new Response('Payload tidak valid', { status: 400 });
        }
        const payload: Omit<ChatPayload, 'id' | 'ts'> = {
          user: body.user,
          text: body.text,
          type: 'user',
        };
        this.broadcast(payload);
        return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
      } catch (err) {
        return new Response((err as Error).message, { status: 500 });
      }
    }

    return new Response("Not found", { status: 404 });
  }
}