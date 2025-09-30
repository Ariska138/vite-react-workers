// src/app/App.tsx

import { useState, useEffect } from 'react'; // Impor useEffect
import reactLogo from './assets/react.svg';
import viteLogo from '/vite.svg';
import cloudflareLogo from './assets/Cloudflare_Logo.svg';
import honoLogo from './assets/hono.svg';
import './App.css';

function App() {
  const [count, setCount] = useState(0);
  const [name, setName] = useState('unknown');

  // 1. State baru untuk menyimpan waktu dari SSE
  const [time, setTime] = useState('connecting...');

  // 2. useEffect untuk menangani koneksi EventSource
  useEffect(() => {
    // Buat koneksi baru ke endpoint SSE Anda
    const eventSource = new EventSource('/api/time');

    // Tangani pesan yang masuk
    eventSource.onmessage = (event) => {
      // Data dari server ada di event.data
      setTime(event.data);
    };

    // Tangani jika ada error koneksi
    eventSource.onerror = () => {
      setTime('connection failed');
      eventSource.close();
    };

    // 3. Fungsi cleanup untuk menutup koneksi saat komponen di-unmount
    return () => {
      eventSource.close();
    };
  }, []); // Array dependensi kosong agar efek ini hanya berjalan sekali

  return (
    <>
      <div>
        {/* ... bagian logo tetap sama ... */}
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
        <a href="https://hono.dev/" target="_blank">
          <img src={honoLogo} className="logo cloudflare" alt="Hono logo" />
        </a>
        <a href="https://workers.cloudflare.com/" target="_blank">
          <img
            src={cloudflareLogo}
            className="logo cloudflare"
            alt="Cloudflare logo"
          />
        </a>
      </div>

      <h1>Vite + React + Hono + Cloudflare</h1>

      {/* 4. Tampilkan data real-time dari SSE */}
      <div className="card">
        <p>Server time (real-time):</p>
        <p>
          <strong>{time}</strong>
        </p>
      </div>

      <div className="card">
        <button
          onClick={() => setCount((count) => count + 1)}
          aria-label="increment"
        >
          count is {count}
        </button>
      </div>

      <div className="card">
        <button
          onClick={() => {
            fetch('/api')
              .then((res) => res.json() as Promise<{ name: string }>)
              .then((data) => setName(data.name));
          }}
          aria-label="get name"
        >
          Name from API is: {name}
        </button>
      </div>
      <p className="read-the-docs">Click on the logos to learn more</p>
    </>
  );
}

export default App;
