import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from 'hono/streaming';


const app = new Hono<{ Bindings: Env }>();

const allowedOrigins = [
  'https://vite-react-workers.vercel.app', // Ganti dengan URL produksi Vercel Anda
];

app.use('*', cors({
  origin: (origin) => {
    // Izinkan URL dari daftar di atas
    if (allowedOrigins.includes(origin)) {
      return origin;
    }
    // Izinkan semua URL preview dari Vercel (contoh: proyek-git-fork-nama.vercel.app)
    if (/\.vercel\.app$/.test(origin)) {
      return origin;
    }
    // Tolak yang lainnya
    return 'https://vite-react-workers.vercel.app'; // URL default jika tidak cocok
  }
}));

const api = new Hono<{ Bindings: Env }>();

api.get("/who", (c) => c.json({ name: "Safa Framework" }));

// Rute baru untuk SSE
api.get('/time', (c) => {
  return streamSSE(c, async (stream) => {
    while (true) {
      const message = `It is ${new Date().toLocaleTimeString()}`;
      await stream.writeSSE({ data: message });
      await stream.sleep(1000); // Tunggu 1 detik
    }
  });
});

app.route("/api", api);

export default app;
