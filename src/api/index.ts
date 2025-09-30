import { Hono } from "hono";
const app = new Hono<{ Bindings: Env }>();

app.get("/", (c) => c.json({ name: "Safa Framework" }));

export default app;
