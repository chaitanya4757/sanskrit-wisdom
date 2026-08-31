require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

const EMBEDDING_MODEL = 'gemini-embedding-001';
const GENERATION_MODEL = 'gemini-3.5-flash-lite';
//const GENERATION_MODEL = 'gemini-3.6-flash';
//const GENERATION_MODEL = 'gemini-2.5-flash'; // fast + cheap, good fit for this use case

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Embeds a single piece of text (used for the live user query at request time).
 * Same model as buildEmbeddings.js — must stay in sync or search results break.
 */
async function embedText(text) {
  const result = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text
  });
  return result.embeddings[0].values;
}

/**
 * Generates the final chatbot answer given a fully-built prompt string.
 */
async function generate(prompt) {
  const result = await ai.models.generateContent({
    model: GENERATION_MODEL,
    contents: prompt
  });
  return result.text;
}

module.exports = { embedText, generate };