const fs = require('fs');
const path = require('path');

const EMBEDDINGS_PATH = path.resolve(__dirname, '../data/embeddings.json');
const VERSES_PATH = path.resolve(__dirname, '../data/verses.json');

// Loaded once at server startup, kept in memory
let embeddingsIndex = [];
let versesByKey = {};

function loadIndex() {
  const embeddings = JSON.parse(fs.readFileSync(EMBEDDINGS_PATH, 'utf-8'));
  const verses = JSON.parse(fs.readFileSync(VERSES_PATH, 'utf-8'));

  versesByKey = {};
  for (const v of verses) {
    versesByKey[`${v.chapter}.${v.verse}`] = v;
  }

  embeddingsIndex = embeddings.map(e => ({
    key: `${e.chapter}.${e.verse}`,
    vector: e.embedding
  }));

  console.log(`Retrieval index loaded: ${embeddingsIndex.length} verses ready for search.`);
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function search(queryVector, topK = 3) {
  const scored = embeddingsIndex.map(entry => ({
    key: entry.key,
    score: cosineSimilarity(queryVector, entry.vector)
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, topK).map(s => ({
    ...versesByKey[s.key],
    similarityScore: s.score
  }));
}

module.exports = { loadIndex, search };