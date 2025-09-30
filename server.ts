import { Hono } from 'hono';
import { serve } from '@hono/node-server';

import api from './src/api/index';
const app = new Hono();

app.route("/api", api);

const port = parseInt(process.env.PORT || '3000', 10);
serve({ fetch: app.fetch, port });
console.log(`🚀 Server running at http://localhost:${port}`);
