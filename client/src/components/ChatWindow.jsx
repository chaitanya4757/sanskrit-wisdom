import { useState } from 'react';
import MessageBubble from './MessageBubble';
import LanguageSelector from './LanguageSelector';
import { sendChatMessage } from '../api/chatApi';

function ChatWindow() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [language, setLanguage] = useState('en');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage = { role: 'user', text: trimmed };
    const updatedMessages = [...messages, userMessage];

    setMessages(updatedMessages);
    setInput('');
    setError(null);
    setLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.text }));
      const data = await sendChatMessage({ message: trimmed, language, history });

      setMessages([
        ...updatedMessages,
        { role: 'assistant', text: data.answer, citations: data.citations }
      ]);
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleReset() {
    setMessages([]);
    setInput('');
    setError(null);
  }

  return (
    <div style={{
      maxWidth: '640px',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      height: '82vh',
      padding: '16px'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '14px'
      }}>
        <LanguageSelector language={language} onChange={setLanguage} />
        <button
          onClick={handleReset}
          style={{
            border: 'none',
            background: 'none',
            color: '#8A6D3B',
            cursor: 'pointer',
            fontSize: '0.9em',
            textDecoration: 'underline'
          }}
        >
          New conversation
        </button>
      </div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px',
        backgroundColor: '#F3ECDD',
        borderRadius: '12px'
      }}>
        {messages.length === 0 && (
          <p style={{ color: '#8A7B63', textAlign: 'center', marginTop: '60px', lineHeight: 1.6 }}>
            Ask a question about life, and receive guidance<br />from the Bhagavad Gita.
          </p>
        )}
        {messages.map((m, i) => (
          <MessageBubble key={i} role={m.role} text={m.text} citations={m.citations} />
        ))}
        {loading && (
          <p style={{ color: '#8A7B63', fontStyle: 'italic', paddingLeft: '4px' }}>Reflecting...</p>
        )}
        {error && <p style={{ color: '#B00020' }}>{error}</p>}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What's on your mind?"
          rows={2}
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: '10px',
            border: '1px solid #D9C8A8',
            resize: 'none',
            fontFamily: 'inherit',
            fontSize: '1em'
          }}
        />
        <button
          onClick={handleSend}
          disabled={loading}
          style={{
            padding: '0 22px',
            borderRadius: '10px',
            border: 'none',
            backgroundColor: loading ? '#D9C8A8' : '#B5651D',
            color: '#fff',
            fontWeight: 500,
            cursor: loading ? 'default' : 'pointer'
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default ChatWindow;