const API_BASE = '';

export async function sendChatMessage({ message, language, history }) {
  const response = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, language, history })
  });

  if (!response.ok) {
    throw new Error('Failed to get a response. Please try again.');
  }

  return response.json();
}