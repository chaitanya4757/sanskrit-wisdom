function MessageBubble({ role, text, citations }) {
  const isUser = role === 'user';

  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      marginBottom: '14px'
    }}>
      <div style={{
        maxWidth: '78%',
        backgroundColor: isUser ? '#B5651D' : '#FFFFFF',
        color: isUser ? '#FFFFFF' : '#2E2A25',
        borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        padding: '12px 16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
      }}>
        <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{text}</p>

        {citations && citations.length > 0 && (
          <div style={{ marginTop: '12px', borderTop: '1px solid #EADFCB', paddingTop: '10px' }}>
            {citations.map((c, i) => (
              <div key={i} style={{
                fontSize: '0.85em',
                marginBottom: '8px',
                backgroundColor: '#FAF6EF',
                borderRadius: '8px',
                padding: '8px 10px',
                color: '#5A4632'
              }}>
                <strong>📖 {c.source} {c.chapter}.{c.verse}</strong>
                <div style={{ marginTop: '4px' }}>{c.translation}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MessageBubble;