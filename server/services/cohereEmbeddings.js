require('dotenv').config();

const COHERE_API_KEY = process.env.COHERE_API_KEY;
const EMBED_URL = 'https://api.cohere.ai/v2/embed';
const MODEL = 'embed-multilingual-v3.0'; // supports English + Hindi, matches our needs

async function callCohereEmbed(texts, inputType) {
  const response = await fetch(EMBED_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${COHERE_API_KEY}`
    },
    body: JSON.stringify({
      texts,
      model: MODEL,
      input_type: inputType,
      embedding_types: ['float']
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Cohere API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  if (!data.embeddings || !Array.isArray(data.embeddings.float)) {
    throw new Error('Unexpected Cohere response shape');
  }
  return data.embeddings.float; // array of vectors, same order as input texts
}

// Used at LIVE CHAT time — embedding the user's question
async function embedText(text) {
  const vectors = await callCohereEmbed([text], 'search_query');
  return vectors[0];
}

// Used when BUILDING THE INDEX — batch of up to 96 verses at once
async function embedBatch(texts) {
  return callCohereEmbed(texts, 'search_document');
}

module.exports = { embedText, embedBatch };