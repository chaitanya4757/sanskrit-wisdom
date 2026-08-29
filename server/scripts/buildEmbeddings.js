require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

const VERSES_PATH = path.resolve(__dirname, '../data/verses.json');
const OUTPUT_PATH = path.resolve(__dirname, '../data/embeddings.json');
const EMBEDDING_MODEL = 'gemini-embedding-001';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const DELAY_MS = 700; // ~85 requests/minute, safely under the 100/min free-tier cap
const MAX_RETRIES = 5;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildEmbeddingText(verse) {
  return [verse.translation_en, verse.transliteration].filter(Boolean).join('\n');
}

function verseKey(verse) {
  return `${verse.chapter}.${verse.verse}`;
}

async function embedWithRetry(text, retriesLeft = MAX_RETRIES) {
  try {
    const result = await ai.models.embedContent({ model: EMBEDDING_MODEL, contents: text });
    return result.embeddings[0].values;
  } catch (err) {
    const is429 = err.message && err.message.includes('RESOURCE_EXHAUSTED');
    if (is429 && retriesLeft > 0) {
      // Try to read Google's suggested retry delay, else back off 20s
      const match = err.message.match(/"retryDelay":"(\d+)s"/);
      const waitMs = match ? parseInt(match[1], 10) * 1000 + 1000 : 20000;
      console.warn(`\nRate limited. Waiting ${waitMs / 1000}s before retry (${retriesLeft} retries left)...`);
      await sleep(waitMs);
      return embedWithRetry(text, retriesLeft - 1);
    }
    throw err;
  }
}

async function main() {
  const verses = JSON.parse(fs.readFileSync(VERSES_PATH, 'utf-8'));

  // Resume support: load whatever's already been embedded, skip those
  let existing = [];
  if (fs.existsSync(OUTPUT_PATH)) {
    existing = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
  }
  const doneKeys = new Set(existing.map(e => `${e.chapter}.${e.verse}`));
  console.log(`Loaded ${verses.length} verses. ${doneKeys.size} already embedded — resuming.`);

  const output = [...existing];

  for (let i = 0; i < verses.length; i++) {
    const verse = verses[i];
    const key = verseKey(verse);
    if (doneKeys.has(key)) continue; // already done, skip

    try {
      const text = buildEmbeddingText(verse);
      const vector = await embedWithRetry(text);
      output.push({ chapter: verse.chapter, verse: verse.verse, embedding: vector });
      process.stdout.write(`\rEmbedded ${output.length}/${verses.length}`);

      // Save progress every 20 verses, so a crash doesn't lose work
      if (output.length % 20 === 0) {
        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output), 'utf-8');
      }
    } catch (err) {
      console.error(`\nGave up on verse ${key} after retries:`, err.message);
    }

    await sleep(DELAY_MS);
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output), 'utf-8');
  console.log(`\n\nDone. Wrote ${output.length}/${verses.length} embeddings to ${OUTPUT_PATH}`);
}

main();