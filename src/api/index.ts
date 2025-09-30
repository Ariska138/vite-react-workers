import { Hono } from "hono";

const app = new Hono();
const api = new Hono();

api.get("/who", (c) => c.json({ name: "Safa Framework" }));

app.route("/api", api);

export { api };

export default app;
