require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { embedBatch } = require('../services/cohereEmbeddings');

const VERSES_PATH = path.resolve(__dirname, '../data/verses.json');
const OUTPUT_PATH = path.resolve(__dirname, '../data/embeddings.json');

const BATCH_SIZE = 90;

function buildEmbeddingText(verse) {
  const themesLine = verse.theme_tags && verse.theme_tags.length > 0
    ? `Themes: ${verse.theme_tags.join(', ')}`
    : null;

  return [verse.translation_en, verse.transliteration, themesLine].filter(Boolean).join('\n');
}

function chunk(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function main() {
  const verses = JSON.parse(fs.readFileSync(VERSES_PATH, 'utf-8'));
  console.log(`Loaded ${verses.length} verses. Embedding in batches of ${BATCH_SIZE} via Cohere...`);

  const batches = chunk(verses, BATCH_SIZE);
  const output = [];

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const texts = batch.map(buildEmbeddingText);

    try {
      const vectors = await embedBatch(texts);
      vectors.forEach((vector, idx) => {
        const verse = batch[idx];
        output.push({ chapter: verse.chapter, verse: verse.verse, embedding: vector });
      });
      console.log(`Batch ${i + 1}/${batches.length} done (${output.length}/${verses.length} verses embedded)`);
    } catch (err) {
      console.error(`Batch ${i + 1} failed:`, err.message);
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output), 'utf-8');
      throw err;
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output), 'utf-8');
  console.log(`\nDone. Wrote ${output.length}/${verses.length} embeddings to ${OUTPUT_PATH}`);
}

main();