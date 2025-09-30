// File: src/env.d.ts

declare global {
  // Deklarasikan interface Env di sini.
  // Ini adalah tempat untuk mendefinisikan tipe untuk semua bindings
  // yang Anda konfigurasi di wrangler.json, seperti KV, R2, D1, Secrets, dll.
  interface Env {
    // Contoh jika Anda memiliki KV namespace bernama MY_KV:
    // MY_KV: KVNamespace;

    // Contoh jika Anda memiliki secret bernama DATABASE_URL:
    // DATABASE_URL: string;
    SAFA_KEY: string;
  }
}

// Baris ini penting untuk memastikan file ini diperlakukan sebagai modul
// dan tipenya diterapkan secara global.
export { };