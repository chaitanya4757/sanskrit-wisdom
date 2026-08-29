const fs = require('fs');
const path = require('path');

// Adjust this if your gita-source folder lives somewhere else relative to this project
const GITA_SOURCE_DIR = path.resolve(__dirname, '../../../gita-source/data');

const ENGLISH_AUTHOR_ID = 18; // Swami Adidevananda
const HINDI_AUTHOR_ID = 1;    // Swami Ramsukhdas
const ENGLISH_LANG_ID = 1;
const HINDI_LANG_ID = 2;

const OUTPUT_PATH = path.resolve(__dirname, '../data/verses.json');

function loadJSON(filename) {
  const raw = fs.readFileSync(path.join(GITA_SOURCE_DIR, filename), 'utf-8');
  return JSON.parse(raw);
}

function main() {
  console.log('Loading source files...');
  const verses = loadJSON('verse.json');
  const translations = loadJSON('translation.json');
  console.log(`Loaded ${verses.length} verses, ${translations.length} translation entries.`);

  // verse_id -> { en, hi }
  const translationMap = {};
  for (const t of translations) {
    if (!translationMap[t.verse_id]) translationMap[t.verse_id] = {};
    if (t.author_id === ENGLISH_AUTHOR_ID && t.language_id === ENGLISH_LANG_ID) {
      translationMap[t.verse_id].en = t.description;
    }
    if (t.author_id === HINDI_AUTHOR_ID && t.language_id === HINDI_LANG_ID) {
      translationMap[t.verse_id].hi = t.description;
    }
  }

  const output = [];
  const missingEnglish = [];
  const missingHindi = [];

  for (const v of verses) {
    const trans = translationMap[v.id] || {};
    if (!trans.en) missingEnglish.push(v.id);
    if (!trans.hi) missingHindi.push(v.id);

    output.push({
      source: 'Bhagavad Gita',
      chapter: v.chapter_number,
      verse: v.verse_number,
      sanskrit: (v.text || '').trim(),
      transliteration: (v.transliteration || '').trim(),
      translation_en: trans.en ? trans.en.trim() : null,
      translation_hi: trans.hi ? trans.hi.trim() : null,
      theme_tags: []
    });
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');

  console.log(`\nWrote ${output.length} verses to ${OUTPUT_PATH}`);
  if (missingEnglish.length) {
    console.warn(`Missing English (author ${ENGLISH_AUTHOR_ID}) for ${missingEnglish.length} verses. First few IDs: ${missingEnglish.slice(0, 15).join(', ')}`);
  }
  if (missingHindi.length) {
    console.warn(`Missing Hindi (author ${HINDI_AUTHOR_ID}) for ${missingHindi.length} verses. First few IDs: ${missingHindi.slice(0, 15).join(', ')}`);
  }
}

main();