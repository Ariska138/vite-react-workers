// api/index.ts
import { handle } from 'hono/vercel';
import app from '../dist/vite_react_workers/index.js';

// Hono's Vercel adapter akan mengubah aplikasi Hono menjadi
// format yang bisa dijalankan oleh Vercel Serverless Function.
export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);

// Default export juga bisa digunakan untuk mencakup semua method
export default handle(app);