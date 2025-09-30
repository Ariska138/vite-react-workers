/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// src/api/worker.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE, SSEStreamingApi } from 'hono/streaming';

// Definisikan tipe data yang lebih ketat
type ChatPayload = {
  id: string;
  user: string;
  text: string;
  ts: string;
  type: 'user' | 'bot' | 'system';
};

const app = new Hono<{ Bindings: Env }>();

// Kebijakan CORS yang disederhanakan untuk Vercel
app.use('*', cors({
  origin: (origin) => {
    if (origin.endsWith('.vercel.app')) {
      return origin;
    }
    // Fallback ke URL produksi utama jika origin tidak ada (misalnya, dari cURL)
    return 'https://vite-react-workers.vercel.app';
  }
}));

const api = new Hono<{ Bindings: Env }>();

api.get('/who', (c) => c.json({ name: 'Safa Framework' }));

/**
 * Broadcaster di dalam memori:
 * - Menyimpan semua koneksi SSE yang aktif.
 * - PENTING: Dalam lingkungan serverless seperti Cloudflare Workers, state ini
 * bersifat sementara dan tidak dibagikan antar instance. Jika aplikasi Anda
 * membutuhkan skalabilitas atau persistensi state, gunakan Durable Objects,
* KV, atau layanan Pub/Sub seperti Redis.
 */
const connected = new Set<SSEStreamingApi>();

function broadcast(payload: Omit<ChatPayload, 'id' | 'ts'>, eventName = 'message') {
  // Buat payload penuh di server untuk memastikan konsistensi data
  const message: ChatPayload = {
    ...payload,
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
  };

  const data = JSON.stringify(message);

  // Salin ke array agar aman saat iterasi jika ada modifikasi pada Set
  Array.from(connected).forEach(async (s) => {
    try {
      await s.writeSSE({ event: eventName, data });
    } catch (err: any) {
      // Abaikan error penulisan; streamSSE akan menutup koneksi yang rusak secara otomatis.
      // Anda bisa menambahkan logging di sini jika perlu.
    }
  });
}

// Helper untuk membuat pesan sapaan dari bot
function botGreetingFor(user = 'guest'): Omit<ChatPayload, 'id' | 'ts'> {
  return {
    user: 'bot',
    text: `Halo ${user}! Selamat datang di chat.`,
    type: 'bot',
  };
}

// Endpoint SSE untuk mendengarkan pesan chat
api.get('/chat', (c) => {
  return streamSSE(c, async (stream) => {
    connected.add(stream);

    const greet = botGreetingFor('pengguna baru');
    broadcast(greet, 'joined');

    // Kirim ping untuk menjaga koneksi tetap hidup setiap 20 detik
    const keepAlive = setInterval(() => {
      stream.writeSSE({ data: '' }).catch(() => {});
    }, 20_000);

    // Tunggu hingga koneksi ditutup oleh klien
    await new Promise<void>((resolve) => {
      stream.onAbort(() => {
        resolve();
      });
    });

    // Proses pembersihan setelah klien terputus
    clearInterval(keepAlive);
    connected.delete(stream);

    // Siarkan bahwa seorang pengguna telah pergi
    const leaveMessage: Omit<ChatPayload, 'id' | 'ts'> = {
      user: 'system',
      text: 'Seorang pengguna meninggalkan chat.',
      type: 'system',
    };
    broadcast(leaveMessage, 'left');
  });
});

// Endpoint POST untuk klien mengirim pesan
api.post('/chat', async (c) => {
  try {
    const body = await c.req.json<{ user?: string; text?: string }>();
    if (!body || typeof body.text !== 'string' || typeof body.user !== 'string') {
      return c.json({ ok: false, error: 'Payload tidak valid, harus berupa { user, text }' }, 400);
    }

    const payload: Omit<ChatPayload, 'id' | 'ts'> = {
      user: body.user,
      text: body.text,
      type: 'user',
    };

    broadcast(payload, 'message');

    return c.json({ ok: true });
  } catch (err) {
    return c.json({ ok: false, error: (err as Error).message }, 500);
  }
});

app.route('/api', api);

export default app;