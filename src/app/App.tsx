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

// 1. Custom Hook untuk mengelola logika chat
function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatStatus, setChatStatus] = useState<ChatStatus>('connecting');
  const chatESRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource('/api/chat');
    chatESRef.current = es;
    setChatStatus('connecting');

    const handleNewMessage = (e: MessageEvent) => {
      try {
        if (e.data) {
          const newMessage = JSON.parse(e.data) as Message;
          setMessages((prev) => [...prev, newMessage]);
        }
      } catch {
        // Abaikan error parsing
      }
    };

    es.addEventListener('message', handleNewMessage);
    es.addEventListener('joined', handleNewMessage);
    es.addEventListener('left', handleNewMessage);

    es.onopen = () => {
      setChatStatus('open');
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          user: 'system',
          text: 'Terhubung ke server chat.',
          ts: new Date().toISOString(),
          type: 'system',
        },
      ]);
    };

    es.onerror = () => {
      setChatStatus('error');
      // EventSource akan mencoba koneksi ulang secara otomatis
    };

    return () => {
      es.close();
      chatESRef.current = null;
      setChatStatus('closed');
    };
  }, []);

  return { messages, chatStatus };
}

// 2. Komponen terpisah untuk merender satu pesan
const ChatMessage = ({ msg, currentUser }: { msg: Message; currentUser: string }) => {
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
  const [count, setCount] = useState(0);
  const [name, setName] = useState('unknown');
  const { messages, chatStatus } = useChat();

  const [msgInput, setMsgInput] = useState('');
  const [displayName, setDisplayName] = useState<string>(
    () => localStorage.getItem('chat:name') ?? `user-${Math.floor(Math.random() * 9000 + 1000)}`
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

  const sendMessage = useCallback(async () => {
    const text = msgInput.trim();
    if (!text) return;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: displayName, text }),
      });
      if (!res.ok) throw new Error('Gagal mengirim pesan');
      setMsgInput('');
    } catch (err) {
      console.error('Gagal mengirim:', err);
      // Anda bisa menambahkan pesan error ke state messages di sini
    }
  }, [msgInput, displayName]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
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
        <a href="https://workers.cloudflare.com/" target="_blank" rel="noreferrer">
          <img src={cloudflareLogo} className="logo cloudflare" alt="Cloudflare logo" />
        </a>
      </div>

      <h1>Vite + React + Hono + Cloudflare</h1>

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
          <h2>Real-time Chat</h2>
          <div className="chat-header">
            <label>
              Nama:
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
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
            <button onClick={sendMessage}>Kirim</button>
          </div>
        </div>
      </div>
    </>
  );
}

export default App;