import { Hono } from "hono";
import { streamSSE } from 'hono/streaming';

const app = new Hono<{ Bindings: Env }>();
const api = new Hono<{ Bindings: Env }>();

api.get("/", (c) => c.json({ name: "Safa Framework" }));

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
