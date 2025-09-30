// File: vite.config.ts

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';

export default defineConfig(({ command }) => {
  // Cek apakah build sedang berjalan di lingkungan Vercel
  const isVercel = process.env.VERCEL === '1';

  if (command === 'serve') {
    // --- Konfigurasi untuk pengembangan lokal (bun run dev) ---
    return {
      plugins: [react()],
      server: {
        proxy: {
          '/api': {
            target: 'http://localhost:3000',
            changeOrigin: true,
          },
        },
      },
    };
  } else {
    // --- Konfigurasi untuk build produksi ---
    // Siapkan plugin dasar yang selalu ada
    const plugins = [react()];

    // Hanya tambahkan plugin cloudflare jika BUKAN di Vercel
    if (!isVercel) {
      plugins.push(cloudflare());
    }

    return {
      plugins: plugins,
    };
  }
});