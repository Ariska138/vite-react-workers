/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/App.tsx
import { useState, useEffect, useRef } from 'react'; // Impor useEffect, useRef
import reactLogo from './assets/react.svg';
import viteLogo from '/vite.svg';
import cloudflareLogo from './assets/Cloudflare_Logo.svg';
import honoLogo from './assets/hono.svg';
import './App.css';

type ChatPayload = { user: string; text: string; ts?: string };

function App() {
  const [count, setCount] = useState(0);
  const [name, setName] = useState('unknown');

  // SSE time
  const [time, setTime] = useState('connecting...');

  // Chat states
  const [messages, setMessages] = useState<ChatPayload[]>([]);
  const [msgInput, setMsgInput] = useState('');
  const [displayName, setDisplayName] = useState<string>(() => {
    // default simple name (you can change)
    return (
      localStorage.getItem('chat:name') ??
      `user-${Math.floor(Math.random() * 9000 + 1000)}`
    );
  });
  const [chatStatus, setChatStatus] = useState<
    'connecting' | 'open' | 'closed' | 'error'
  >('connecting');
  const msgBoxRef = useRef<HTMLDivElement | null>(null);

  // keep EventSource refs so we can close them on unmount
  const timeESRef = useRef<EventSource | null>(null);
  const chatESRef = useRef<EventSource | null>(null);

  // Persist displayName
  useEffect(() => {
    localStorage.setItem('chat:name', displayName);
  }, [displayName]);

  // SSE for /api/time (unchanged)
  useEffect(() => {
    const es = new EventSource('/api/time');
    timeESRef.current = es;

    es.onmessage = (event) => {
      setTime(event.data);
    };

    es.onerror = () => {
      setTime('connection failed');
      es.close();
    };

    return () => {
      es.close();
      timeESRef.current = null;
    };
  }, []);

  // SSE for /api/chat (messages)
  useEffect(() => {
    const es = new EventSource('/api/chat');
    chatESRef.current = es;
    setChatStatus('connecting');

    // default 'message' event (fallback)
    es.addEventListener('message', (e: MessageEvent) => {
      if (!e.data) return;
      try {
        const p = JSON.parse(e.data) as ChatPayload;
        setMessages((m) => [...m, p]);
      } catch {
        // ignore parse errors
      }
    });

    // custom 'joined' event (bot / user joined)
    es.addEventListener('joined', (e: MessageEvent) => {
      try {
        if (e.data) {
          const p = JSON.parse(e.data) as ChatPayload;
          setMessages((m) => [...m, p]);
        }
      } catch {
        // ignore parse errors
      }
    });

    // custom 'left' event
    es.addEventListener('left', (e: MessageEvent) => {
      try {
        if (e.data) {
          const p = JSON.parse(e.data) as ChatPayload;
          setMessages((m) => [...m, p]);
        }
      } catch (e: any) {
        console.log(e);
      }
    });

    es.onopen = () => {
      setChatStatus('open');
      // optional: announce locally that we're connected
      setMessages((m) => [
        ...m,
        {
          user: 'system',
          text: 'Connected to chat server',
          ts: new Date().toISOString(),
        },
      ]);
    };

    es.onerror = (err) => {
      // EventSource will auto-reconnect by default; mark error state
      console.warn('chat SSE error', err);
      setChatStatus('error');
      // keep it open for reconnects; if you want to stop: es.close()
    };

    return () => {
      es.close();
      chatESRef.current = null;
      setChatStatus('closed');
    };
  }, []);

  // autoscroll to bottom when messages change
  useEffect(() => {
    const el = msgBoxRef.current;
    if (!el) return;
    // small timeout to wait DOM update
    setTimeout(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }, 30);
  }, [messages]);

  // helper to send message via POST /api/chat
  async function sendMessage() {
    const text = msgInput.trim();
    if (!text) return;
    const payload = { user: displayName, text };
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      // optionally append locally (server will broadcast back anyway)
      setMessages((m) => [
        ...m,
        { user: displayName, text, ts: new Date().toISOString() },
      ]);
      setMsgInput('');
    } catch (err) {
      console.error('failed send', err);
      setMessages((m) => [
        ...m,
        {
          user: 'system',
          text: 'Failed to send message',
          ts: new Date().toISOString(),
        },
      ]);
    }
  }

  // send on Enter
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank" rel="noreferrer">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank" rel="noreferrer">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
        <a href="https://hono.dev/" target="_blank" rel="noreferrer">
          <img src={honoLogo} className="logo cloudflare" alt="Hono logo" />
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

      {/* Server time */}
      <div className="card">
        <p>Server time (real-time):</p>
        <p>
          <strong>{time}</strong>
        </p>
      </div>

      <div className="card">
        <button onClick={() => setCount((c) => c + 1)} aria-label="increment">
          count is {count}
        </button>
      </div>

      <div className="card">
        <button
          onClick={() => {
            fetch('/api/who')
              .then((res) => res.json() as Promise<{ name: string }>)
              .then((data) => setName(data.name));
          }}
          aria-label="get name"
        >
          Name from API is: {name}
        </button>
      </div>

      {/* Chat UI */}
      <div className="card" style={{ marginTop: 16 }}>
        <h2>Chat (SSE)</h2>
        <div style={{ marginBottom: 8 }}>
          <label>
            Nama:
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              style={{ marginLeft: 8 }}
            />
          </label>
          <span style={{ marginLeft: 12, fontSize: 12, color: '#666' }}>
            Status: <strong>{chatStatus}</strong>
          </span>
        </div>

        <div
          ref={msgBoxRef}
          style={{
            height: 240,
            overflow: 'auto',
            border: '1px solid #ccc',
            padding: 8,
            borderRadius: 6,
            background: '#fff',
          }}
        >
          {messages.map((m, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              <small style={{ color: '#666', marginRight: 6 }}>
                {m.ts ? new Date(m.ts).toLocaleTimeString() : ''}
              </small>
              <strong style={{ marginRight: 6 }}>{m.user}</strong>:{' '}
              <span style={{ marginLeft: 6 }}>{m.text}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <input
            placeholder="Tulis pesan..."
            value={msgInput}
            onChange={(e) => setMsgInput(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ flex: 1 }}
          />
          <button onClick={sendMessage}>Kirim</button>
        </div>
      </div>

      <p className="read-the-docs">Click on the logos to learn more</p>
    </>
  );
}

export default App;

