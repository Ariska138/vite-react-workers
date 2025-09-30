// src/app/App.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import reactLogo from './assets/react.svg';
import viteLogo from '/vite.svg';
import cloudflareLogo from './assets/Cloudflare_Logo.svg';
import honoLogo from './assets/hono.svg';
import './App.css';

// Tipe data untuk pesan chat
type Message = {
  id: string;
  user: string;
  text: string;
  ts: string;
  type: 'user' | 'bot' | 'system';
};

// Tipe untuk status koneksi chat
type ChatStatus = 'connecting' | 'open' | 'closed' | 'error';

// 1. Custom Hook untuk logika chat dengan SSE
function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatStatus, setChatStatus] = useState<ChatStatus>('connecting');
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // URL endpoint SSE
    const sseUrl = '/api/chat/events';

    const events = new EventSource(sseUrl);
    eventSourceRef.current = events;
    setChatStatus('connecting');

    const handleNewMessage = (e: MessageEvent) => {
      try {
        if (e.data) {
          const newMessage = JSON.parse(e.data) as Message;
          setMessages((prev) => [...prev, newMessage]);
        }
      } catch (err) {
        console.error('Gagal mem-parsing data pesan:', err);
      }
    };

    events.addEventListener('message', handleNewMessage);

    events.onopen = () => {
      setChatStatus('open');
    };

    events.onerror = () => {
      setChatStatus('error');
      events.close(); // Tutup koneksi jika terjadi error
    };

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setChatStatus('closed');
    };
  }, []);

  // Fungsi sendMessage tetap sama, karena menggunakan fetch POST
  const sendMessage = useCallback(async (displayName: string, text: string) => {
    if (!text || !displayName) return;

    try {
      const res = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: displayName, text }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Gagal mengirim pesan: ${res.status} ${errorText}`);
      }
    } catch (err) {
      console.error('Gagal mengirim:', err);
      // Tambahkan pesan error ke chat untuk feedback ke pengguna
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        user: 'system',
        text: 'Pesan Anda gagal terkirim.',
        ts: new Date().toISOString(),
        type: 'system',
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
  }, []);

  return { messages, chatStatus, sendMessage };
}

// 2. Komponen ChatMessage (tidak ada perubahan)
const ChatMessage = ({
  msg,
  currentUser,
}: {
  msg: Message;
  currentUser: string;
}) => {
  const isOwn = msg.user === currentUser && msg.type === 'user';
  const msgClass = `message ${isOwn ? 'own' : ''} ${msg.type}-message`;

  return (
    <div className={msgClass}>
      {msg.type !== 'system' && (
        <div className="meta">
          <strong>{isOwn ? 'Anda' : msg.user}</strong>
          <span style={{ marginLeft: 8 }}>
            {new Date(msg.ts).toLocaleTimeString()}
          </span>
        </div>
      )}
      <div className="text">{msg.text}</div>
    </div>
  );
};

// Komponen Aplikasi Utama
function App() {
  const { messages, chatStatus, sendMessage } = useChat();
  const [count, setCount] = useState(0);
  const [name, setName] = useState('unknown');

  const [msgInput, setMsgInput] = useState('');
  const [displayName, setDisplayName] = useState<string>(
    () =>
      localStorage.getItem('chat:name') ??
      `user-${Math.floor(Math.random() * 9000 + 1000)}`
  );
  const msgBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    localStorage.setItem('chat:name', displayName);
  }, [displayName]);

  useEffect(() => {
    const el = msgBoxRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = () => {
    sendMessage(displayName, msgInput);
    setMsgInput(''); // Kosongkan input setelah mengirim
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <div className="logos">
        <a href="https://vite.dev" target="_blank" rel="noreferrer">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank" rel="noreferrer">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
        <a href="https://hono.dev/" target="_blank" rel="noreferrer">
          <img src={honoLogo} className="logo hono" alt="Hono logo" />
        </a>
        <a
          href="https://workers.cloudflare.com/"
          target="_blank"
          rel="noreferrer"
        >
          <img
            src={cloudflareLogo}
            className="logo cloudflare"
            alt="Cloudflare logo"
          />
        </a>
      </div>

      <h1>Vite + React + Hono + Cloudflare</h1>
      <h2>Real-time Updates with SSE</h2>

      <div className="card">
        <button onClick={() => setCount((c) => c + 1)}>
          Hitungan: {count}
        </button>
        <button
          style={{ marginLeft: 16 }}
          onClick={() => {
            fetch('/api/who')
              .then((res) => res.json() as Promise<{ name: string }>)
              .then((data) => setName(data.name));
          }}
        >
          Nama dari API: {name}
        </button>
      </div>

      <div className="card">
        <div className="chat-container">
          <h2>Real-time Data Stream (SSE)</h2>
          <div className="chat-header">
            <label>
              Nama:
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </label>
            <span className="status-indicator">
              Status: <strong>{chatStatus}</strong>
            </span>
          </div>

          <div ref={msgBoxRef} className="messages-box">
            {messages.map((m) => (
              <ChatMessage key={m.id} msg={m} currentUser={displayName} />
            ))}
          </div>

          <div className="message-input-area">
            <input
              placeholder="Tulis pesan..."
              value={msgInput}
              onChange={(e) => setMsgInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button onClick={handleSend}>Kirim</button>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
