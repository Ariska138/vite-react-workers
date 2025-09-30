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
  sessions: WebSocket[] = [];

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  // Fungsi untuk menyiarkan pesan ke semua koneksi WebSocket yang aktif
  broadcast(payload: Omit<ChatPayload, 'id' | 'ts'>) {
    const message: ChatPayload = {
      ...payload,
      id: crypto.randomUUID(),
      ts: new Date().toISOString(),
    };
    const data = JSON.stringify(message);

    // Kirim pesan ke setiap sesi yang masih terbuka
    this.sessions = this.sessions.filter(session => {
      try {
        session.send(data);
        return true;
      } catch (err) {
        // Hapus sesi jika sudah tertutup
        return false;
      }
    });
  }

  // Metode fetch yang dipanggil oleh worker utama
  async fetch(request: Request) {
    const url = new URL(request.url);

    // Rute untuk menangani koneksi WebSocket
    if (url.pathname.endsWith("/websocket")) {
      const upgradeHeader = request.headers.get('Upgrade');
      if (!upgradeHeader || upgradeHeader !== 'websocket') {
        return new Response('Expected Upgrade: websocket', { status: 426 });
      }

      // Terima koneksi WebSocket
      const [client, server] = Object.values(new WebSocketPair());
      await this.handleSession(server);

      // Kirim respons untuk menyelesaikan handshake WebSocket
      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    // Rute untuk menerima pesan via POST
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

  // Menangani sesi WebSocket baru
  async handleSession(ws: WebSocket) {
    (ws as any).accept();
    this.sessions.push(ws);

    // Siarkan pesan selamat datang saat pengguna baru bergabung
    this.broadcast({
      user: 'bot',
      text: 'Seorang pengguna baru telah bergabung.',
      type: 'bot'
    });

    // Tangani pesan yang masuk dari klien (opsional, karena kita pakai POST)
    ws.addEventListener("message", async (_msg) => {
      // Di arsitektur ini, kita mengirim pesan via POST, jadi ini bisa dikosongkan
      // atau digunakan untuk hal lain seperti sinyal 'typing...'
    });

    // Tangani saat koneksi ditutup
    ws.addEventListener("close", () => {
      // Hapus sesi dari daftar
      this.sessions = this.sessions.filter(s => s !== ws);
      this.broadcast({
        user: 'system',
        text: 'Seorang pengguna meninggalkan chat.',
        type: 'system'
      });
    });
  }
}