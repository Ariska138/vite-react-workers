import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';

// Ubah export default menjadi sebuah fungsi yang menerima 'command'
export default defineConfig(({ command }) => {
  if (command === 'serve') {
    // === KONFIGURASI UNTUK PENGEMBANGAN LOKAL (bun run dev) ===
    return {
      plugins: [
        react() // Hanya plugin react
      ],
      server: {
        proxy: {
          // Arahkan /api ke server wrangler remote
          '/api': {
            target: 'http://localhost:3000',
            changeOrigin: true,
          },
        },
      },
    };
  } else {
    // === KONFIGURASI UNTUK PRODUKSI (bun run build) ===
    return {
      plugins: [
        react(),
        cloudflare() // Plugin cloudflare() hanya aktif di sini
      ],
    };
  }
});