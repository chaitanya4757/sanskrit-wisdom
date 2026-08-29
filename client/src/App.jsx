import ChatWindow from './components/ChatWindow';

function App() {
  return (
    <div style={{ backgroundColor: '#FAF6EF', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center', padding: '20px 0 4px' }}>
        <h1 style={{
          margin: 0,
          fontSize: '1.6em',
          color: '#5A4632',
          fontWeight: 600,
          letterSpacing: '0.5px'
        }}>
          🕉️ Gita Guidance
        </h1>
        <p style={{ margin: '4px 0 0', color: '#A89478', fontSize: '0.9em' }}>
          Life wisdom from the Bhagavad Gita
        </p>
      </div>
      <ChatWindow />
    </div>
  );
}

export default App;